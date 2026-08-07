// Map composite driving health (behavior + data) → green/yellow/orange/red for AI summary box.

import type { DrivingHealth } from "@/lib/driving-health";

export type UsageLevel = "green" | "yellow" | "orange" | "red";

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
