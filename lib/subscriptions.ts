// Domain logic for creating subscriptions and early-end with ledger lines.

import {
  LedgerEntryType,
  Prisma,
  SubscriptionStatus,
  VehicleStatus,
  type Plan,
  type Subscription,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

const LIVE: SubscriptionStatus[] = [
  SubscriptionStatus.RESERVED,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.ENDING,
];

export class SubscriptionError extends Error {
  constructor(
    public code:
      | "VEHICLE_NOT_AVAILABLE"
      | "VEHICLE_NOT_BOOKABLE"
      | "NOT_FOUND"
      | "INVALID_STATE",
    message: string,
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

function utcToday() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function periodEndFor(start: Date) {
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );
}

export async function createSubscription(input: {
  driverId: string;
  vehicleId: string;
  planId: string;
}) {
  try {
    return await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: VehicleStatus; odometer: number }>
      >`
        SELECT id, status, odometer FROM vehicles
        WHERE id = ${input.vehicleId}
        FOR UPDATE
      `;
      if (!locked[0]) throw new SubscriptionError("NOT_FOUND", "Vehicle not found");
      if (locked[0].status === VehicleStatus.PENDING_INTAKE) {
        throw new SubscriptionError(
          "VEHICLE_NOT_BOOKABLE",
          "Vehicle pending intake",
        );
      }

      const [plan, driver] = await Promise.all([
        tx.plan.findUnique({ where: { id: input.planId } }),
        tx.driver.findUnique({ where: { id: input.driverId } }),
      ]);
      if (!plan) throw new SubscriptionError("NOT_FOUND", "Plan not found");
      if (!driver) throw new SubscriptionError("NOT_FOUND", "Driver not found");

      const start = utcToday();
      const id = `sub-${randomUUID().slice(0, 8)}`;

      const sub = await tx.subscription.create({
        data: {
          id,
          driverId: input.driverId,
          vehicleId: input.vehicleId,
          planId: input.planId,
          status: SubscriptionStatus.ACTIVE,
          monthlyPrice: plan.basePrice,
          startDate: start,
          endDate: null,
          billingPeriodStart: start,
          billingPeriodEnd: periodEndFor(start),
          startOdometer: locked[0].odometer,
          milesThisPeriod: 0,
        },
      });

      await tx.domainEvent.create({
        data: {
          id: `evt-${randomUUID().slice(0, 8)}`,
          at: new Date(),
          type: "subscription.started",
          subjectType: "subscription",
          subjectId: sub.id,
          data: {
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            planId: input.planId,
          },
        },
      });

      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { status: VehicleStatus.SUBSCRIBED },
      });

      return { id: sub.id };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new SubscriptionError(
        "VEHICLE_NOT_AVAILABLE",
        "Vehicle already has a live commitment",
      );
    }
    throw e;
  }
}

function buildEarlyEndLedger(args: {
  subscription: Subscription;
  plan: Plan;
  mode: "SCHEDULE" | "IMMEDIATE";
  asOf: Date;
  endDate: Date;
}) {
  const price = args.subscription.monthlyPrice;
  const milesUsed = args.subscription.milesThisPeriod;
  const included = args.plan.monthlyMiles;
  const overageMiles = Math.max(0, milesUsed - included);
  const overageAmt = args.plan.overagePerMile.mul(overageMiles);

  const milesLines = [
    {
      type: LedgerEntryType.MILES_INCLUDED,
      amount: new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(included),
      unit: "miles",
      explanation: `Plan includes ${included} miles this period.`,
    },
    {
      type: LedgerEntryType.MILES_USED,
      amount: new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(milesUsed),
      unit: "miles",
      explanation: `Driver used ${milesUsed} miles this period (subscription.milesThisPeriod).`,
    },
    {
      type: LedgerEntryType.OVERAGE,
      amount: overageAmt,
      quantity: new Prisma.Decimal(overageMiles),
      unit: "miles",
      explanation: `Overage ${overageMiles} mi × $${args.plan.overagePerMile}/mi = $${overageAmt}.`,
    },
  ];

  if (args.mode === "SCHEDULE") {
    return [
      {
        type: LedgerEntryType.PERIOD_BASE,
        amount: price,
        quantity: null as Prisma.Decimal | null,
        unit: null as string | null,
        explanation: `Scheduled early end through ${args.endDate.toISOString().slice(0, 10)}: charge full period base $${price}.`,
      },
      ...milesLines,
    ];
  }

  const periodStart =
    args.subscription.billingPeriodStart ?? args.subscription.startDate;
  const periodEnd = args.subscription.billingPeriodEnd ?? args.asOf;
  const totalDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const usedDays = Math.max(
    1,
    Math.round((args.asOf.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const prorated = price.mul(usedDays).div(totalDays).toDecimalPlaces(2);

  return [
    {
      type: LedgerEntryType.PRORATION,
      amount: prorated,
      quantity: new Prisma.Decimal(usedDays),
      unit: "days",
      explanation: `Immediate end: prorate $${price} × ${usedDays}/${totalDays} days = $${prorated}.`,
    },
    ...milesLines,
  ];
}

export async function earlyEndSubscription(input: {
  subscriptionId: string;
  mode: "SCHEDULE" | "IMMEDIATE";
  endDate?: string;
}) {
  return db.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({
      where: { id: input.subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new SubscriptionError("NOT_FOUND", "Subscription not found");
    if (!LIVE.includes(sub.status)) {
      throw new SubscriptionError(
        "INVALID_STATE",
        `Cannot early-end subscription in status ${sub.status}`,
      );
    }

    await tx.$queryRaw`
      SELECT id FROM vehicles WHERE id = ${sub.vehicleId} FOR UPDATE
    `;

    const asOf = utcToday();
    const endDate =
      input.mode === "SCHEDULE"
        ? input.endDate
          ? new Date(`${input.endDate}T00:00:00.000Z`)
          : asOf
        : asOf;

    const lines = buildEarlyEndLedger({
      subscription: sub,
      plan: sub.plan,
      mode: input.mode,
      asOf,
      endDate,
    });

    if (input.mode === "SCHEDULE") {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.ENDING, endDate },
      });
      await tx.domainEvent.create({
        data: {
          id: `evt-${randomUUID().slice(0, 8)}`,
          at: new Date(),
          type: "subscription.end_scheduled",
          subjectType: "subscription",
          subjectId: sub.id,
          data: { endDate: endDate.toISOString().slice(0, 10) },
        },
      });
    } else {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.ENDED, endDate },
      });
      await tx.domainEvent.create({
        data: {
          id: `evt-${randomUUID().slice(0, 8)}`,
          at: new Date(),
          type: "subscription.ended",
          subjectType: "subscription",
          subjectId: sub.id,
          data: { mode: "IMMEDIATE" },
        },
      });
      await tx.vehicle.update({
        where: { id: sub.vehicleId },
        data: { status: VehicleStatus.AVAILABLE },
      });
    }

    await tx.ledgerEntry.createMany({
      data: lines.map((line) => ({
        subscriptionId: sub.id,
        type: line.type,
        amount: line.amount,
        quantity: line.quantity,
        unit: line.unit,
        explanation: line.explanation,
      })),
    });

    return { id: sub.id, mode: input.mode, ledgerLines: lines.length };
  });
}
