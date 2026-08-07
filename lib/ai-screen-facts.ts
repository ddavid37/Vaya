// Load live DB facts for the AI chat based on current screen (no invented rows).

import { db } from "@/lib/db";

const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;

/**
 * Short factual snapshot the model may cite. Empty string if nothing useful.
 */
export async function factsForScreen(
  pathname: string,
  search = "",
): Promise<string> {
  const path = pathname || "/";
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );

  try {
    if (path === "/" || path === "") {
      const bookable = await db.vehicle.findMany({
        where: {
          status: { not: "PENDING_INTAKE" },
          subscriptions: { none: { status: { in: [...LIVE] } } },
        },
        select: { id: true, make: true, model: true, year: true },
        orderBy: { id: "asc" },
      });
      const byMake = new Map<string, number>();
      for (const v of bookable) {
        byMake.set(v.make, (byMake.get(v.make) ?? 0) + 1);
      }
      const makeLines = [...byMake.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([make, n]) => `${make}: ${n}`)
        .join("; ");
      const list = bookable
        .map((v) => `${v.id} ${v.year} ${v.make} ${v.model}`)
        .join(" | ");
      return [
        `Bookable vehicles right now: ${bookable.length}.`,
        `Count by make: ${makeLines || "none"}.`,
        `List: ${list || "none"}.`,
      ].join(" ");
    }

    if (path.startsWith("/mine")) {
      return "My cars shows only the signed-in Google driver’s subscriptions (early end + ledger). Exact rows depend on who is signed in — ask them to look at the cards if you lack session.";
    }

    if (path === "/ops" || path === "/ops/") {
      const [vehicleCount, liveCount, conflictCount] = await Promise.all([
        db.vehicle.count(),
        db.subscription.count({ where: { status: { in: [...LIVE] } } }),
        db.dataConflict.count(),
      ]);
      return `Fleet: ${vehicleCount} vehicles; ${liveCount} live commitments (RESERVED/ACTIVE/ENDING); ${conflictCount} conflict records.`;
    }

    if (path.startsWith("/ops/conflicts")) {
      const conflicts = await db.dataConflict.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { type: true, subjectIds: true, resolution: true },
      });
      return `Conflicts (${conflicts.length} shown): ${conflicts
        .map(
          (c) =>
            `${c.type} [${c.subjectIds.join(", ")}] → ${c.resolution}`,
        )
        .join(" || ") || "none"}.`;
    }

    if (path.startsWith("/ops/disputes")) {
      const imei = params.get("imei") ?? "";
      if (!imei) {
        const devices = await db.device.findMany({
          orderBy: { imei: "asc" },
          take: 20,
          select: { imei: true },
        });
        return `Mileage review: no IMEI selected. Devices: ${devices.map((d) => d.imei).join(", ") || "none"}.`;
      }
      const trips = await db.trip.findMany({
        where: { imei },
        orderBy: { startAt: "asc" },
        include: { mileageDecision: true },
      });
      const trusted = trips.reduce((s, t) => {
        const m = t.mileageDecision?.trustedMiles;
        return s + (m != null ? Number(m.toString()) : 0);
      }, 0);
      return [
        `IMEI ${imei}: ${trips.length} trips; sum trusted miles ≈ ${trusted.toFixed(1)}.`,
        `Trips: ${trips
          .map(
            (t) =>
              `${t.transactionId} ${t.assemblyStatus} trusted=${t.mileageDecision?.trustedMiles?.toString() ?? "—"}`,
          )
          .join(" | ") || "none"}.`,
      ].join(" ");
    }

    if (path.startsWith("/ops/signals")) {
      const n = await db.trip.count();
      return `Signals screen aggregates tripMetrics across ingested trips (trip count in DB: ${n}).`;
    }
  } catch (e) {
    console.error("factsForScreen", e);
    return "Live DB snapshot failed; answer from product rules only.";
  }

  return "";
}
