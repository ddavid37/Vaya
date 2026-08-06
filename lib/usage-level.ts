// Map composite driving health (behavior + data) → green/yellow/orange/red for AI summary box.

import type { DrivingHealth } from "@/lib/driving-health";

export type UsageLevel = "green" | "yellow" | "orange" | "red";

export const USAGE_LEGEND: Array<{
  level: UsageLevel;
  label: string;
  circle: string;
}> = [
  { level: "green", label: "Healthy overall", circle: "bg-green-600" },
  { level: "yellow", label: "Fair overall", circle: "bg-yellow-400" },
  { level: "orange", label: "Poor / caution", circle: "bg-orange-500" },
  { level: "red", label: "Severe overall", circle: "bg-red-600" },
];

/** Map health band → usage color (AI box). Poor → orange; avgPoints ≥ 1.75 → red. */
export function usageLevelFromHealth(
  health: DrivingHealth,
  avgPoints: number | null,
): UsageLevel {
  if (health === "unknown" || avgPoints == null) return "yellow";
  if (avgPoints >= 1.75) return "red";
  if (health === "healthy") return "green";
  if (health === "fair") return "yellow";
  return "orange"; // poor
}

export function usageOverallLine(level: UsageLevel): string {
  return `Overall, the use of the car is ${level}.`;
}
