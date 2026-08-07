// Tailwind class maps for driving-health bands (kept under fe/ so the scanner emits them).

import type { DrivingHealth } from "@/lib/driving-health";

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
