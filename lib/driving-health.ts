// Composite trip driving-health: behavior metrics + data-quality (demo heuristics).

export type DrivingHealth = "healthy" | "fair" | "poor" | "unknown";

type Component = {
  name: string;
  input: string;
  band: DrivingHealth;
  /** 0 = healthy, 1 = fair, 2 = poor */
  points: number;
};

export type DrivingHealthResult = {
  health: DrivingHealth;
  mpg: number | null;
  label: string;
  /** Human-readable formula shown under DRIVING HEALTH */
  calculation: string;
  components: Component[];
  /** Mean component points (for rollups / usage-level mapping) */
  avgPoints: number | null;
};

function bandFromPoints(avg: number): DrivingHealth {
  if (avg < 0.75) return "healthy";
  if (avg < 1.5) return "fair";
  return "poor";
}

/** Frame / status text classes from driving health. */
export function healthFrameClass(health: DrivingHealth): string {
  switch (health) {
    case "healthy":
      return "border-green-400";
    case "fair":
      return "border-yellow-400";
    case "poor":
      return "border-red-400";
    default:
      return "border-rule";
  }
}

export function healthColor(health: DrivingHealth): string {
  switch (health) {
    case "healthy":
      return "text-green-700";
    case "fair":
      return "text-yellow-600";
    case "poor":
      return "text-red-600";
    default:
      return "text-muted";
  }
}

function dataHealthComponent(
  assemblyStatus: string | null | undefined,
  flags: string[] | null | undefined,
): Component {
  const f = flags ?? [];
  const status = assemblyStatus ?? "";

  if (
    status === "IMPOSSIBLE_ODOMETER" ||
    f.includes("impossible_odometer")
  ) {
    return {
      name: "dataHealth",
      input: "impossible_odometer",
      band: "poor",
      points: 2,
    };
  }
  if (status === "METRICS_DELAYED" || f.includes("metrics_delayed")) {
    return {
      name: "dataHealth",
      input: "metrics_delayed",
      band: "poor",
      points: 2,
    };
  }
  if (
    f.includes("duplicate_trip_end") ||
    f.includes("vin_from_assignment") ||
    f.includes("revised_metrics") ||
    status === "INCOMPLETE" ||
    status === "OPEN"
  ) {
    const why =
      [
        f.includes("duplicate_trip_end") ? "duplicate_trip_end" : null,
        f.includes("vin_from_assignment") ? "vin_from_assignment" : null,
        f.includes("revised_metrics") ? "revised_metrics" : null,
        status === "INCOMPLETE" || status === "OPEN" ? status : null,
      ]
        .filter(Boolean)
        .join("+") || "soft_flag";
    return {
      name: "dataHealth",
      input: why,
      band: "fair",
      points: 1,
    };
  }
  return {
    name: "dataHealth",
    input: "clean",
    band: "healthy",
    points: 0,
  };
}

/**
 * Score one trip:
 * - fuel mi/gal, averageDriveSpeed, hardBrakingCounts, hardAccelerationCounts
 * - dataHealth from assembly status / flags (always included)
 *
 * Points 0/1/2 → average → healthy / fair / poor.
 */
export function scoreDrivingHealth(args: {
  miles: number | null;
  fuelConsumed: number | null;
  averageDriveSpeed: number | null;
  hardBrakingCounts: number | null;
  hardAccelerationCounts: number | null;
  assemblyStatus?: string | null;
  flags?: string[] | null;
}): DrivingHealthResult {
  const components: Component[] = [];
  let mpg: number | null = null;

  const { miles, fuelConsumed } = args;
  if (
    miles != null &&
    fuelConsumed != null &&
    fuelConsumed > 0 &&
    miles > 0
  ) {
    mpg = miles / fuelConsumed;
    if (mpg >= 28) {
      components.push({
        name: "fuel",
        input: `${mpg.toFixed(1)} mi/gal`,
        band: "healthy",
        points: 0,
      });
    } else if (mpg >= 18) {
      components.push({
        name: "fuel",
        input: `${mpg.toFixed(1)} mi/gal`,
        band: "fair",
        points: 1,
      });
    } else {
      components.push({
        name: "fuel",
        input: `${mpg.toFixed(1)} mi/gal`,
        band: "poor",
        points: 2,
      });
    }
  }

  if (args.averageDriveSpeed != null) {
    const s = args.averageDriveSpeed;
    if (s <= 35) {
      components.push({
        name: "averageDriveSpeed",
        input: `${s} mph`,
        band: "healthy",
        points: 0,
      });
    } else if (s <= 50) {
      components.push({
        name: "averageDriveSpeed",
        input: `${s} mph`,
        band: "fair",
        points: 1,
      });
    } else {
      components.push({
        name: "averageDriveSpeed",
        input: `${s} mph`,
        band: "poor",
        points: 2,
      });
    }
  }

  if (args.hardBrakingCounts != null) {
    const b = args.hardBrakingCounts;
    if (b === 0) {
      components.push({
        name: "hardBrakingCounts",
        input: String(b),
        band: "healthy",
        points: 0,
      });
    } else if (b <= 2) {
      components.push({
        name: "hardBrakingCounts",
        input: String(b),
        band: "fair",
        points: 1,
      });
    } else {
      components.push({
        name: "hardBrakingCounts",
        input: String(b),
        band: "poor",
        points: 2,
      });
    }
  }

  if (args.hardAccelerationCounts != null) {
    const a = args.hardAccelerationCounts;
    if (a === 0) {
      components.push({
        name: "hardAccelerationCounts",
        input: String(a),
        band: "healthy",
        points: 0,
      });
    } else if (a <= 2) {
      components.push({
        name: "hardAccelerationCounts",
        input: String(a),
        band: "fair",
        points: 1,
      });
    } else {
      components.push({
        name: "hardAccelerationCounts",
        input: String(a),
        band: "poor",
        points: 2,
      });
    }
  }

  // Data quality always participates when we have a trip row.
  components.push(dataHealthComponent(args.assemblyStatus, args.flags));

  // If only dataHealth (no behavior/fuel), still score.
  const avg =
    components.reduce((s, c) => s + c.points, 0) / components.length;
  const health = bandFromPoints(avg);
  const parts = components
    .map((c) => `${c.name} ${c.input}→${c.band}(${c.points})`)
    .join("; ");
  const calculation = `avg([${parts}]) = ${avg.toFixed(2)} → ${health} (thresholds: <0.75 healthy, <1.5 fair, else poor; includes dataHealth)`;

  return {
    health,
    mpg,
    label: `${health} composite from ${components.length} input(s)`,
    calculation,
    components,
    avgPoints: avg,
  };
}

export type VinTripInput = {
  miles: number | null;
  fuelConsumed: number | null;
  averageDriveSpeed: number | null;
  hardBrakingCounts: number | null;
  hardAccelerationCounts: number | null;
  assemblyStatus?: string | null;
  flags?: string[] | null;
};

/**
 * Overall VIN / device health: mean of per-trip composite scores (behavior + data).
 */
export function scoreVinDrivingHealth(trips: VinTripInput[]): DrivingHealthResult & {
  tripCount: number;
  scoredCount: number;
  meanSpeed: number | null;
  meanHardBrake: number | null;
  meanHardAccel: number | null;
} {
  const scored = trips.map((t) => scoreDrivingHealth(t));

  const speeds = trips
    .map((t) => t.averageDriveSpeed)
    .filter((v): v is number => v != null);
  const brakes = trips
    .map((t) => t.hardBrakingCounts)
    .filter((v): v is number => v != null);
  const accels = trips
    .map((t) => t.hardAccelerationCounts)
    .filter((v): v is number => v != null);

  const mean = (xs: number[]) =>
    xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)) : null;

  const meanSpeed = mean(speeds);
  const meanHardBrake = mean(brakes);
  const meanHardAccel = mean(accels);

  if (scored.length === 0) {
    return {
      health: "unknown",
      mpg: null,
      label: "No trips for this VIN in view",
      calculation: "n/a — no trips in current filter",
      components: [],
      avgPoints: null,
      tripCount: 0,
      scoredCount: 0,
      meanSpeed,
      meanHardBrake,
      meanHardAccel,
    };
  }

  const avg =
    scored.reduce((s, h) => s + (h.avgPoints ?? 0), 0) / scored.length;
  const health = bandFromPoints(avg);

  const counts = { healthy: 0, fair: 0, poor: 0, unknown: 0 };
  for (const h of scored) {
    counts[h.health] += 1;
  }

  const calculation = `VIN rollup: mean of ${scored.length} trip scores (behavior+dataHealth) = ${avg.toFixed(2)} → ${health} (healthy/fair/poor ${counts.healthy}/${counts.fair}/${counts.poor}; mean avgSpeed ${meanSpeed ?? "—"} mph, mean hardBrake ${meanHardBrake ?? "—"}, mean hardAccel ${meanHardAccel ?? "—"})`;

  return {
    health,
    mpg: null,
    label: `${health} over ${scored.length} trip(s)`,
    calculation,
    components: [],
    avgPoints: avg,
    tripCount: trips.length,
    scoredCount: scored.length,
    meanSpeed,
    meanHardBrake,
    meanHardAccel,
  };
}
