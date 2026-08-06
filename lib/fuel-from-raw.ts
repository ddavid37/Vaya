// Pull fuelConsumed from tripEnd (or REST trip) raw payloads by transactionId.

export function fuelByTransactionId(
  rows: Array<{ transactionId: string | null; payload: unknown }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.transactionId) continue;
    const payload = row.payload as {
      data?: { fuelConsumed?: unknown };
    };
    const v = payload.data?.fuelConsumed;
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))
          ? Number(v)
          : null;
    if (n != null && Number.isFinite(n)) {
      map.set(row.transactionId, n);
    }
  }
  return map;
}
