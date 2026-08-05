/**
 * Load data/seed.json as-is into Postgres.
 * Quarantine dual-live losers as CONFLICTING; record data_conflicts.
 * Does not rewrite prices or drop rows.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ConflictType,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  VehicleStatus,
} from "@prisma/client";

const db = new PrismaClient();

const LIVE: SubscriptionStatus[] = [
  SubscriptionStatus.RESERVED,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.ENDING,
];

type Seed = {
  dealers: Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    joinedAt: string;
  }>;
  plans: Array<{
    id: string;
    name: string;
    tier: string;
    monthlyMiles: number;
    overagePerMile: number;
    basePrice: number;
  }>;
  vehicles: Array<{
    id: string;
    vin: string;
    dealerId: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    color: string;
    odometer: number;
    status: string;
    monthlyPrice: number | null;
    listedAt: string;
  }>;
  drivers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    licenseState: string;
    createdAt: string;
  }>;
  subscriptions: Array<{
    id: string;
    driverId: string;
    vehicleId: string;
    planId: string;
    status: string;
    monthlyPrice: number;
    startDate: string;
    endDate: string | null;
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    startOdometer: number;
    milesThisPeriod: number;
    cancelledAt?: string;
    previousPlanId?: string;
    previousMonthlyPrice?: number;
  }>;
  events: Array<{
    id: string;
    at: string;
    type: string;
    subjectType: string;
    subjectId: string;
    data: Record<string, unknown>;
  }>;
};

function dateOnly(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

function isLiveStatus(status: string) {
  return LIVE.includes(status as SubscriptionStatus);
}

/** Resolve dual-live before insert so the partial unique index can accept the load. */
function quarantinePlan(seed: Seed) {
  const liveByVehicle = new Map<string, Seed["subscriptions"]>();
  for (const sub of seed.subscriptions) {
    if (!isLiveStatus(sub.status)) continue;
    const list = liveByVehicle.get(sub.vehicleId) ?? [];
    list.push(sub);
    liveByVehicle.set(sub.vehicleId, list);
  }

  const statusOverride = new Map<string, SubscriptionStatus>();
  const dualConflicts: Array<{ winnerId: string; loserId: string }> = [];

  for (const [, subs] of liveByVehicle) {
    if (subs.length < 2) continue;
    const sorted = [...subs].sort((a, b) => {
      const byDate = a.startDate.localeCompare(b.startDate);
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });
    const [winner, ...losers] = sorted;
    for (const loser of losers) {
      statusOverride.set(loser.id, SubscriptionStatus.CONFLICTING);
      dualConflicts.push({ winnerId: winner.id, loserId: loser.id });
    }
  }

  return { statusOverride, dualConflicts };
}

async function main() {
  const seed = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/seed.json"), "utf8"),
  ) as Seed;
  const { statusOverride, dualConflicts } = quarantinePlan(seed);

  await db.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany();
    await tx.dataConflict.deleteMany();
    await tx.domainEvent.deleteMany();
    await tx.subscription.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.driver.deleteMany();
    await tx.plan.deleteMany();
    await tx.dealer.deleteMany();

    await tx.dealer.createMany({
      data: seed.dealers.map((d) => ({
        ...d,
        joinedAt: dateOnly(d.joinedAt),
      })),
    });
    await tx.plan.createMany({
      data: seed.plans.map((p) => ({
        id: p.id,
        name: p.name,
        tier: p.tier,
        monthlyMiles: p.monthlyMiles,
        overagePerMile: new Prisma.Decimal(p.overagePerMile),
        basePrice: new Prisma.Decimal(p.basePrice),
      })),
    });
    await tx.driver.createMany({
      data: seed.drivers.map((d) => ({
        ...d,
        createdAt: dateOnly(d.createdAt),
      })),
    });
    await tx.vehicle.createMany({
      data: seed.vehicles.map((v) => ({
        id: v.id,
        vin: v.vin,
        dealerId: v.dealerId,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim,
        color: v.color,
        odometer: v.odometer,
        status: v.status as VehicleStatus,
        monthlyPrice:
          v.monthlyPrice == null ? null : new Prisma.Decimal(v.monthlyPrice),
        listedAt: dateOnly(v.listedAt),
      })),
    });
    await tx.subscription.createMany({
      data: seed.subscriptions.map((s) => ({
        id: s.id,
        driverId: s.driverId,
        vehicleId: s.vehicleId,
        planId: s.planId,
        status: statusOverride.get(s.id) ?? (s.status as SubscriptionStatus),
        monthlyPrice: new Prisma.Decimal(s.monthlyPrice),
        startDate: dateOnly(s.startDate),
        endDate: s.endDate ? dateOnly(s.endDate) : null,
        billingPeriodStart: s.billingPeriodStart
          ? dateOnly(s.billingPeriodStart)
          : null,
        billingPeriodEnd: s.billingPeriodEnd
          ? dateOnly(s.billingPeriodEnd)
          : null,
        startOdometer: s.startOdometer,
        milesThisPeriod: s.milesThisPeriod,
        cancelledAt: s.cancelledAt ? new Date(s.cancelledAt) : null,
        previousPlanId: s.previousPlanId ?? null,
        previousMonthlyPrice:
          s.previousMonthlyPrice == null
            ? null
            : new Prisma.Decimal(s.previousMonthlyPrice),
      })),
    });
    await tx.domainEvent.createMany({
      data: seed.events.map((e) => ({
        id: e.id,
        at: new Date(e.at),
        type: e.type,
        subjectType: e.subjectType,
        subjectId: e.subjectId,
        data: e.data as Prisma.InputJsonValue,
      })),
    });

    for (const { winnerId, loserId } of dualConflicts) {
      await tx.dataConflict.create({
        data: {
          type: ConflictType.DUAL_LIVE_SUBSCRIPTION,
          subjectType: "subscription",
          subjectIds: [winnerId, loserId],
          resolution: `Kept ${winnerId} live; quarantined ${loserId} as CONFLICTING`,
          rationale:
            "One live commitment per vehicle. Earliest startDate wins; seed dual-ACTIVE kept visible via quarantine.",
        },
      });
    }
  });

  const quarantined = dualConflicts.map((c) => c.loserId);

  // Flag mismatches — do not rewrite source rows
  const vehicles = await db.vehicle.findMany({
    include: { subscriptions: true },
  });
  const plans = new Map((await db.plan.findMany()).map((p) => [p.id, p]));

  for (const v of vehicles) {
    const liveSubs = v.subscriptions.filter((s) => LIVE.includes(s.status));
    const hasLive = liveSubs.length > 0;
    const statusSaysTaken =
      v.status === VehicleStatus.SUBSCRIBED ||
      v.status === VehicleStatus.RESERVED;

    if (
      v.status !== VehicleStatus.PENDING_INTAKE &&
      ((hasLive && v.status === VehicleStatus.AVAILABLE) ||
        (!hasLive && statusSaysTaken))
    ) {
      await db.dataConflict.create({
        data: {
          type: ConflictType.VEHICLE_STATUS_MISMATCH,
          subjectType: "vehicle",
          subjectIds: [v.id, ...liveSubs.map((s) => s.id)],
          resolution:
            "Left vehicle.status unchanged; marketplace uses live subscription set",
          rationale: `vehicle.status=${v.status} but liveCount=${liveSubs.length}`,
        },
      });
    }

    for (const s of v.subscriptions) {
      const plan = plans.get(s.planId);
      if (plan && !plan.basePrice.equals(s.monthlyPrice)) {
        await db.dataConflict.create({
          data: {
            type: ConflictType.PRICE_MISMATCH,
            subjectType: "subscription",
            subjectIds: [s.id, s.planId],
            resolution:
              "Billing uses subscription.monthlyPrice; catalog basePrice untouched",
            rationale: `plan.basePrice=${plan.basePrice} vs subscription.monthlyPrice=${s.monthlyPrice}`,
          },
        });
      }
      if (s.startOdometer > v.odometer) {
        await db.dataConflict.create({
          data: {
            type: ConflictType.ODOMETER_IMPOSSIBILITY,
            subjectType: "subscription",
            subjectIds: [s.id, v.id],
            resolution: "Left both values as-is",
            rationale: `startOdometer ${s.startOdometer} > vehicle.odometer ${v.odometer}`,
          },
        });
      }
    }
  }

  const counts = {
    dealers: await db.dealer.count(),
    plans: await db.plan.count(),
    vehicles: await db.vehicle.count(),
    drivers: await db.driver.count(),
    subscriptions: await db.subscription.count(),
    domainEvents: await db.domainEvent.count(),
    conflicts: await db.dataConflict.count(),
    quarantined,
  };
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
