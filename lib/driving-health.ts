// Composite trip driving-health from fuel + tripMetrics (demo heuristics, not insurer-grade).

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
};

function bandFromPoints(avg: number): DrivingHealth {
  if (avg < 0.75) return "healthy";
  if (avg < 1.5) return "fair";
  return "poor";
}

/**
 * Score one trip using whatever inputs exist:
 * - fuel → mi/gal from trusted miles / fuelConsumed
 * - averageDriveSpeed
 * - hardBrakingCounts
 * - hardAccelerationCounts
 *
 * Each present input maps to healthy(0) / fair(1) / poor(2). Overall =
 * average of those points → healthy / fair / poor. Missing inputs are skipped
 * (not invented). If none present → unknown.
 */
export function scoreDrivingHealth(args: {
  miles: number | null;
  fuelConsumed: number | null;
  averageDriveSpeed: number | null;
  hardBrakingCounts: number | null;
  hardAccelerationCounts: number | null;
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

  if (components.length === 0) {
    return {
      health: "unknown",
      mpg,
      label: "No fuel or tripMetrics inputs for health score",
      calculation: "n/a — need fuelConsumed and/or tripMetrics",
      components,
    };
  }

  const avg =
    components.reduce((s, c) => s + c.points, 0) / components.length;
  const health = bandFromPoints(avg);
  const parts = components
    .map((c) => `${c.name} ${c.input}→${c.band}(${c.points})`)
    .join("; ");
  const calculation = `avg([${parts}]) = ${avg.toFixed(2)} → ${health} (thresholds: <0.75 healthy, <1.5 fair, else poor; points 0/1/2)`;

  return {
    health,
    mpg,
    label: `${health} composite from ${components.length} input(s)`,
    calculation,
    components,
  };
}

/** @deprecated use scoreDrivingHealth — kept name for older call sites during rename */
export function drivingHealthFromFuel(args: {
  miles: number | null;
  fuelConsumed: number | null;
  averageDriveSpeed?: number | null;
  hardBrakingCounts?: number | null;
  hardAccelerationCounts?: number | null;
}): DrivingHealthResult {
  return scoreDrivingHealth({
    miles: args.miles,
    fuelConsumed: args.fuelConsumed,
    averageDriveSpeed: args.averageDriveSpeed ?? null,
    hardBrakingCounts: args.hardBrakingCounts ?? null,
    hardAccelerationCounts: args.hardAccelerationCounts ?? null,
  });
}

export function healthColor(health: DrivingHealth): string {
  switch (health) {
    case "healthy":
      return "text-green-700";
    case "fair":
      return "text-orange";
    case "poor":
      return "text-red-600";
    default:
      return "text-muted";
  }
}

export type VinTripInput = {
  miles: number | null;
  fuelConsumed: number | null;
  averageDriveSpeed: number | null;
  hardBrakingCounts: number | null;
  hardAccelerationCounts: number | null;
};

/**
 * Overall VIN health for trips in the current filter:
 * score each trip, average points of known trips, same band thresholds.
 * Also reports mean speed / mean hard events used in the rollup line.
 */
export function scoreVinDrivingHealth(trips: VinTripInput[]): DrivingHealthResult & {
  tripCount: number;
  scoredCount: number;
  meanSpeed: number | null;
  meanHardBrake: number | null;
  meanHardAccel: number | null;
} {
  const scored = trips
    .map((t) => scoreDrivingHealth(t))
    .filter((h) => h.health !== "unknown");

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
      label: "No scored trips for this VIN in view",
      calculation: "n/a — no trip health inputs in current filter",
      components: [],
      tripCount: trips.length,
      scoredCount: 0,
      meanSpeed,
      meanHardBrake,
      meanHardAccel,
    };
  }

  const avg =
    scored.reduce((s, h) => {
      const pts =
        h.components.reduce((a, c) => a + c.points, 0) / h.components.length;
      return s + pts;
    }, 0) / scored.length;
  const health = bandFromPoints(avg);

  const counts = { healthy: 0, fair: 0, poor: 0 };
  for (const h of scored) {
    if (h.health === "healthy" || h.health === "fair" || h.health === "poor") {
      counts[h.health] += 1;
    }
  }

  const calculation = `VIN rollup: mean of ${scored.length} trip scores = ${avg.toFixed(2)} → ${health} (trips healthy/fair/poor ${counts.healthy}/${counts.fair}/${counts.poor}; mean avgSpeed ${meanSpeed ?? "—"} mph, mean hardBrake ${meanHardBrake ?? "—"}, mean hardAccel ${meanHardAccel ?? "—"})`;

  return {
    health,
    mpg: null,
    label: `${health} over ${scored.length} trip(s)`,
    calculation,
    components: [],
    tripCount: trips.length,
    scoredCount: scored.length,
    meanSpeed,
    meanHardBrake,
    meanHardAccel,
  };
}
