// Assemble trips from telemetry_raw and write mileage_decisions with provenance (never average).

import { Prisma, PrismaClient, MileageSource, TripAssemblyStatus } from "@prisma/client";

const db = new PrismaClient();

type Payload = {
  deliveredAt: string;
  source: string;
  event: string;
  data: Record<string, unknown>;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dec(n: number | null): Prisma.Decimal | null {
  return n == null ? null : new Prisma.Decimal(n);
}

async function vinAt(imei: string, at: Date | null): Promise<string | null> {
  if (!at) return null;
  const row = await db.deviceVehicleAssignment.findFirst({
    where: {
      imei,
      startedAt: { lte: at },
      OR: [{ endedAt: null }, { endedAt: { gt: at } }],
    },
    orderBy: { startedAt: "desc" },
  });
  return row?.vin ?? null;
}

function decideMileage(args: {
  startOdo: number | null;
  endOdo: number | null;
  tripDistance: number | null;
}): {
  trustedMiles: number | null;
  source: MileageSource;
  discardedInputs: Prisma.InputJsonValue;
  rationale: string;
  impossibleOdo: boolean;
} {
  const { startOdo, endOdo, tripDistance } = args;
  const discarded: Record<string, unknown> = {};
  const impossibleOdo =
    startOdo != null && endOdo != null && endOdo < startOdo;

  const asJson = (v: Record<string, unknown>) =>
    v as Prisma.InputJsonValue;

  if (impossibleOdo) {
    discarded.odometerDelta = {
      startOdo,
      endOdo,
      reason: "end odometer below start",
    };
    if (tripDistance != null) {
      return {
        trustedMiles: tripDistance,
        source: MileageSource.TRIP_DISTANCE,
        discardedInputs: asJson(discarded),
        rationale: `Rejected odometer delta (${startOdo} → ${endOdo}); trusted tripDistance ${tripDistance} mi.`,
        impossibleOdo: true,
      };
    }
    discarded.tripDistance = { reason: "missing" };
    return {
      trustedMiles: null,
      source: MileageSource.NONE,
      discardedInputs: asJson(discarded),
      rationale: "Impossible odometer and no tripDistance — no trusted miles.",
      impossibleOdo: true,
    };
  }

  if (startOdo != null && endOdo != null) {
    const delta = endOdo - startOdo;
    if (tripDistance != null) {
      discarded.tripDistance = {
        value: tripDistance,
        reason: "odometer delta preferred when monotonic",
        deltaVsDistance: Number((delta - tripDistance).toFixed(3)),
      };
    }
    return {
      trustedMiles: delta,
      source: MileageSource.ODOMETER_DELTA,
      discardedInputs: asJson(discarded),
      rationale: `Trusted odometer delta ${startOdo} → ${endOdo} = ${delta} mi (not averaged with tripDistance).`,
      impossibleOdo: false,
    };
  }

  discarded.odometerDelta = { reason: "incomplete start/end odometer" };
  if (tripDistance != null) {
    return {
      trustedMiles: tripDistance,
      source: MileageSource.TRIP_DISTANCE,
      discardedInputs: asJson(discarded),
      rationale: `Trusted tripDistance ${tripDistance} mi (odometer incomplete).`,
      impossibleOdo: false,
    };
  }

  discarded.tripDistance = { reason: "missing" };
  return {
    trustedMiles: null,
    source: MileageSource.NONE,
    discardedInputs: asJson(discarded),
    rationale: "No odometer pair and no tripDistance — no trusted miles.",
    impossibleOdo: false,
  };
}

async function main() {
  await db.mileageDecision.deleteMany();
  await db.trip.deleteMany();

  const raw = await db.telemetryRaw.findMany({
    orderBy: [{ deliveredAt: "asc" }],
  });

  const byTx = new Map<string, typeof raw>();
  for (const row of raw) {
    if (!row.transactionId) continue;
    if (
      !["tripStart", "tripEnd", "tripMetrics", "trip"].includes(row.event)
    ) {
      continue;
    }
    const list = byTx.get(row.transactionId) ?? [];
    list.push(row);
    byTx.set(row.transactionId, list);
  }

  let assembled = 0;

  for (const [transactionId, events] of byTx) {
    let imei: string | null = null;
    let vin: string | null = null;
    let startAt: Date | null = null;
    let endAt: Date | null = null;
    let startOdo: number | null = null;
    let endOdo: number | null = null;
    let tripDistance: number | null = null;
    let metricsDeliveredAt: Date | null = null;
    const flags = new Set<string>();
    const notes: string[] = [];

    // Last-writer by deliveredAt for duplicate ends/metrics.
    const sorted = [...events].sort(
      (a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime(),
    );

    for (const row of sorted) {
      const payload = row.payload as unknown as Payload;
      const d = payload.data ?? {};
      imei = str(d.imei) ?? row.imei ?? imei;

      if (row.event === "tripStart") {
        startAt = asDate(d.timestamp) ?? row.eventAt ?? startAt;
        startOdo = num((d.start as { odometer?: unknown } | undefined)?.odometer) ?? startOdo;
        vin = str(d.vin) ?? vin;
        flags.add("webhook_start");
      } else if (row.event === "tripEnd") {
        endAt = asDate(d.timestamp) ?? row.eventAt ?? endAt;
        endOdo = num((d.end as { odometer?: unknown } | undefined)?.odometer) ?? endOdo;
        vin = str(d.vin) ?? vin;
        if (flags.has("webhook_end")) flags.add("duplicate_trip_end");
        flags.add("webhook_end");
      } else if (row.event === "tripMetrics") {
        tripDistance = num(d.tripDistance) ?? tripDistance;
        metricsDeliveredAt = row.deliveredAt;
        vin = str(d.vin) ?? vin;
        if (flags.has("webhook_metrics")) flags.add("revised_metrics");
        flags.add("webhook_metrics");
      } else if (row.event === "trip") {
        // REST complete shape — fill gaps; do not invent VIN.
        flags.add("rest_trip");
        startAt = asDate(d.startTime) ?? startAt;
        endAt = asDate(d.endTime) ?? endAt;
        startOdo = num(d.startOdometer) ?? startOdo;
        endOdo = num(d.endOdometer) ?? endOdo;
        tripDistance = num(d.distance) ?? tripDistance;
        imei = str(d.imei) ?? imei;
      }
    }

    if (!imei) {
      notes.push("Skipped: no IMEI on any fragment");
      continue;
    }

    if (!vin && startAt) {
      vin = await vinAt(imei, startAt);
      if (vin) flags.add("vin_from_assignment");
    }

    if (
      metricsDeliveredAt &&
      endAt &&
      metricsDeliveredAt.getTime() - endAt.getTime() > 36 * 3600 * 1000
    ) {
      flags.add("metrics_delayed");
    }

    const mileage = decideMileage({ startOdo, endOdo, tripDistance });
    if (mileage.impossibleOdo) flags.add("impossible_odometer");

    let status: TripAssemblyStatus = TripAssemblyStatus.INCOMPLETE;
    if (startAt && endAt && (tripDistance != null || (startOdo != null && endOdo != null))) {
      status = TripAssemblyStatus.COMPLETE;
    } else if (startAt && endAt) {
      status = TripAssemblyStatus.INCOMPLETE;
    } else if (startAt || endAt) {
      status = TripAssemblyStatus.OPEN;
    }
    if (flags.has("metrics_delayed")) status = TripAssemblyStatus.METRICS_DELAYED;
    if (mileage.impossibleOdo) status = TripAssemblyStatus.IMPOSSIBLE_ODOMETER;

    const trip = await db.trip.create({
      data: {
        transactionId,
        imei,
        vin,
        startAt,
        endAt,
        startOdometer: dec(startOdo),
        endOdometer: dec(endOdo),
        tripDistance: dec(tripDistance),
        assemblyStatus: status,
        flags: [...flags],
        notes: notes.length ? notes.join(" ") : null,
      },
    });

    await db.mileageDecision.create({
      data: {
        tripId: trip.id,
        trustedMiles: dec(mileage.trustedMiles),
        source: mileage.source,
        discardedInputs: mileage.discardedInputs,
        rationale: mileage.rationale,
      },
    });

    assembled += 1;
  }

  const byStatus = await db.trip.groupBy({
    by: ["assemblyStatus"],
    _count: true,
  });

  console.log(
    JSON.stringify(
      {
        transactionGroups: byTx.size,
        tripsAssembled: assembled,
        byStatus,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
