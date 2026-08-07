// Pure mileage decision rules for trips — prefer odometer when sane; never average with tripDistance.

export type MileageSourceName = "ODOMETER_DELTA" | "TRIP_DISTANCE" | "NONE";

export type MileageDecisionResult = {
  trustedMiles: number | null;
  source: MileageSourceName;
  discardedInputs: Record<string, unknown>;
  rationale: string;
  impossibleOdo: boolean;
};

/** Decide billable miles for one trip. Never averages odometer delta with tripDistance. */
export function decideMileage(args: {
  startOdo: number | null;
  endOdo: number | null;
  tripDistance: number | null;
}): MileageDecisionResult {
  const { startOdo, endOdo, tripDistance } = args;
  const discarded: Record<string, unknown> = {};
  const impossibleOdo =
    startOdo != null && endOdo != null && endOdo < startOdo;

  if (impossibleOdo) {
    discarded.odometerDelta = {
      startOdo,
      endOdo,
      reason: "end odometer below start",
    };
    if (tripDistance != null) {
      return {
        trustedMiles: tripDistance,
        source: "TRIP_DISTANCE",
        discardedInputs: discarded,
        rationale: `Rejected odometer delta (${startOdo} → ${endOdo}); trusted tripDistance ${tripDistance} mi.`,
        impossibleOdo: true,
      };
    }
    discarded.tripDistance = { reason: "missing" };
    return {
      trustedMiles: null,
      source: "NONE",
      discardedInputs: discarded,
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
      source: "ODOMETER_DELTA",
      discardedInputs: discarded,
      rationale: `Trusted odometer delta ${startOdo} → ${endOdo} = ${delta} mi (not averaged with tripDistance).`,
      impossibleOdo: false,
    };
  }

  discarded.odometerDelta = { reason: "incomplete start/end odometer" };
  if (tripDistance != null) {
    return {
      trustedMiles: tripDistance,
      source: "TRIP_DISTANCE",
      discardedInputs: discarded,
      rationale: `Trusted tripDistance ${tripDistance} mi (odometer incomplete).`,
      impossibleOdo: false,
    };
  }

  discarded.tripDistance = { reason: "missing" };
  return {
    trustedMiles: null,
    source: "NONE",
    discardedInputs: discarded,
    rationale: "No odometer pair and no tripDistance — no trusted miles.",
    impossibleOdo: false,
  };
}

/** Events that participate in trip assembly (tripData / mil / battery do not). */
export const TRIP_ASSEMBLY_EVENTS = new Set([
  "tripStart",
  "tripEnd",
  "tripMetrics",
  "trip",
]);

export function isTripAssemblyEvent(event: string): boolean {
  return TRIP_ASSEMBLY_EVENTS.has(event);
}

/** Flag metrics that arrived long after trip end (delayed reconnect burst). */
export function isMetricsDelayed(
  endAt: Date | null,
  metricsDeliveredAt: Date | null,
  thresholdMs = 36 * 3600 * 1000,
): boolean {
  if (!endAt || !metricsDeliveredAt) return false;
  return metricsDeliveredAt.getTime() - endAt.getTime() > thresholdMs;
}

/**
 * Given sorted assignment intervals and a trip start time, which VIN was bound?
 * Used so REST trips without VIN still resolve through device history.
 */
export function vinAtTime(
  intervals: Array<{ vin: string; startedAt: Date; endedAt: Date | null }>,
  at: Date,
): string | null {
  const hit = intervals
    .filter(
      (i) =>
        i.startedAt.getTime() <= at.getTime() &&
        (i.endedAt == null || i.endedAt.getTime() > at.getTime()),
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  return hit?.vin ?? null;
}
