// Deterministic green→red usage level from assembled trip flags (shared by AI summary API + UI).

export type UsageLevel = "green" | "yellow" | "orange" | "red";

export const USAGE_LEGEND: Array<{
  level: UsageLevel;
  label: string;
  circle: string;
}> = [
  { level: "green", label: "Clean trusted miles", circle: "bg-green-600" },
  { level: "yellow", label: "Minor data issues", circle: "bg-yellow-400" },
  { level: "orange", label: "Delayed messy metrics", circle: "bg-orange-500" },
  { level: "red", label: "Serious data problems", circle: "bg-red-600" },
];

export function rateUsage(
  trips: Array<{ assemblyStatus: string; flags: string[] }>,
): UsageLevel {
  if (trips.length === 0) return "yellow";

  let hasImpossible = false;
  let hasDelayed = false;
  let hasOther = false;

  for (const t of trips) {
    if (
      t.assemblyStatus === "IMPOSSIBLE_ODOMETER" ||
      t.flags.includes("impossible_odometer")
    ) {
      hasImpossible = true;
    } else if (
      t.assemblyStatus === "METRICS_DELAYED" ||
      t.flags.includes("metrics_delayed")
    ) {
      hasDelayed = true;
    } else if (
      t.flags.includes("duplicate_trip_end") ||
      t.flags.includes("vin_from_assignment") ||
      t.assemblyStatus === "INCOMPLETE" ||
      t.assemblyStatus === "OPEN"
    ) {
      hasOther = true;
    }
  }

  if (hasImpossible) return "red";
  if (hasDelayed) return "orange";
  if (hasOther) return "yellow";
  return "green";
}

export function usageOverallLine(level: UsageLevel): string {
  return `Overall, the use of the car is ${level}.`;
}
