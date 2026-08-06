// Deterministic idempotency keys for telemetry_raw — distinguishes redelivered duplicates by deliveredAt.

import { createHash } from "node:crypto";

export type FeedLineKeyInput = {
  deliveredAt: string;
  source: string;
  event: string;
  data: Record<string, unknown>;
  endpoint?: string;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Natural key for a feed line — same envelope redelivered later must still diverge. */
export function naturalKeyFor(line: FeedLineKeyInput): string {
  const d = line.data ?? {};
  const parts = [
    line.source,
    line.event,
    line.deliveredAt,
    asString(d.imei) ?? "",
    asString(d.transactionId) ?? "",
    asString(d.timestamp) ?? asString(d.startTime) ?? "",
    line.endpoint ?? "",
  ];
  const base = parts.join("|");
  const digest = createHash("sha256")
    .update(JSON.stringify(line.data))
    .digest("hex")
    .slice(0, 12);
  return `${base}|${digest}`;
}
