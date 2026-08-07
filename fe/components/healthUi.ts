// Driving-health frame + label classes (plain CSS in globals.css — not Tailwind palette scan).

import type { DrivingHealth } from "@/lib/driving-health";

/** Colored card border from driving health. */
export function healthFrameClass(health: DrivingHealth): string {
  switch (health) {
    case "healthy":
      return "trip-frame-healthy";
    case "fair":
      return "trip-frame-fair";
    case "poor":
      return "trip-frame-poor";
    default:
      return "trip-frame-unknown";
  }
}

/** Colored HEALTHY / FAIR / POOR (and status) label. */
export function healthColor(health: DrivingHealth): string {
  switch (health) {
    case "healthy":
      return "trip-text-healthy";
    case "fair":
      return "trip-text-fair";
    case "poor":
      return "trip-text-poor";
    default:
      return "trip-text-unknown";
  }
}
