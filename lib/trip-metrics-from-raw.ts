// Extract per-trip feed metrics from telemetry_raw (tripEnd fuel + tripMetrics speeds/events).

export type TripFeedMetrics = {
  fuelConsumed: number | null;
  averageDriveSpeed: number | null;
  hardBrakingCounts: number | null;
  hardAccelerationCounts: number | null;
};

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

export function metricsByTransactionId(
  rows: Array<{
    event: string;
    transactionId: string | null;
    payload: unknown;
  }>,
): Map<string, TripFeedMetrics> {
  const map = new Map<string, TripFeedMetrics>();

  function bucket(tx: string): TripFeedMetrics {
    const existing = map.get(tx);
    if (existing) return existing;
    const fresh: TripFeedMetrics = {
      fuelConsumed: null,
      averageDriveSpeed: null,
      hardBrakingCounts: null,
      hardAccelerationCounts: null,
    };
    map.set(tx, fresh);
    return fresh;
  }

  for (const row of rows) {
    if (!row.transactionId) continue;
    const data = (row.payload as { data?: Record<string, unknown> }).data ?? {};
    const b = bucket(row.transactionId);

    if (row.event === "tripEnd" || row.event === "trip") {
      const fuel = asNum(data.fuelConsumed);
      if (fuel != null) b.fuelConsumed = fuel;
    }
    if (row.event === "tripMetrics") {
      const speed = asNum(data.averageDriveSpeed);
      const brake = asNum(data.hardBrakingCounts);
      const accel = asNum(data.hardAccelerationCounts);
      if (speed != null) b.averageDriveSpeed = speed;
      if (brake != null) b.hardBrakingCounts = brake;
      if (accel != null) b.hardAccelerationCounts = accel;
    }
  }

  return map;
}

export function aggregateDriveSignals(
  metrics: Iterable<TripFeedMetrics>,
): {
  avgSpeed: number | null;
  hardBrakeSum: number;
  hardAccelSum: number;
  fuelSum: number;
  samplesWithSpeed: number;
  samplesWithFuel: number;
} {
  let speedSum = 0;
  let samplesWithSpeed = 0;
  let hardBrakeSum = 0;
  let hardAccelSum = 0;
  let fuelSum = 0;
  let samplesWithFuel = 0;

  for (const m of metrics) {
    if (m.averageDriveSpeed != null) {
      speedSum += m.averageDriveSpeed;
      samplesWithSpeed += 1;
    }
    if (m.hardBrakingCounts != null) hardBrakeSum += m.hardBrakingCounts;
    if (m.hardAccelerationCounts != null) {
      hardAccelSum += m.hardAccelerationCounts;
    }
    if (m.fuelConsumed != null) {
      fuelSum += m.fuelConsumed;
      samplesWithFuel += 1;
    }
  }

  return {
    avgSpeed:
      samplesWithSpeed > 0
        ? Number((speedSum / samplesWithSpeed).toFixed(1))
        : null,
    hardBrakeSum,
    hardAccelSum,
    fuelSum: Number(fuelSum.toFixed(2)),
    samplesWithSpeed,
    samplesWithFuel,
  };
}
