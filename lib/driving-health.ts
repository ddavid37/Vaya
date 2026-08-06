// Trip driving-health hint from fuelConsumed + trusted miles (feed units as gallons-ish).

export type DrivingHealth = "healthy" | "fair" | "poor" | "unknown";

/**
 * Higher mi/gal ≈ healthier efficiency for this pilot sketch.
 * Thresholds are demo heuristics, not OEM ratings.
 */
export function drivingHealthFromFuel(args: {
  miles: number | null;
  fuelConsumed: number | null;
}): {
  health: DrivingHealth;
  mpg: number | null;
  label: string;
} {
  const { miles, fuelConsumed } = args;
  if (
    miles == null ||
    fuelConsumed == null ||
    fuelConsumed <= 0 ||
    miles <= 0
  ) {
    return {
      health: "unknown",
      mpg: null,
      label: "No fuelConsumed for this trip",
    };
  }

  const mpg = miles / fuelConsumed;
  if (mpg >= 28) {
    return {
      health: "healthy",
      mpg,
      label: `Healthy efficiency (~${mpg.toFixed(1)} mi/gal)`,
    };
  }
  if (mpg >= 18) {
    return {
      health: "fair",
      mpg,
      label: `Fair efficiency (~${mpg.toFixed(1)} mi/gal)`,
    };
  }
  return {
    health: "poor",
    mpg,
    label: `Poor efficiency (~${mpg.toFixed(1)} mi/gal)`,
  };
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
