// Ops disputes: explain trusted trip miles for an IMEI (and optional period) without inventing data.

import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmtMi(v: { toString(): string } | null | undefined) {
  if (v == null) return "—";
  return `${Number(v.toString()).toFixed(1)} mi`;
}

function fmtTs(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ imei?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const devices = await db.device.findMany({ orderBy: { imei: "asc" } });
  const imei = sp.imei ?? devices[0]?.imei ?? "";
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(sp.to) : null;

  const trips = imei
    ? await db.trip.findMany({
        where: {
          imei,
          ...(from || to
            ? {
                startAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        include: { mileageDecision: true },
        orderBy: { startAt: "asc" },
      })
    : [];

  const trustedSum = trips.reduce((sum, t) => {
    const m = t.mileageDecision?.trustedMiles;
    return sum + (m != null ? Number(m.toString()) : 0);
  }, 0);

  const flagged = trips.filter(
    (t) =>
      t.assemblyStatus === "IMPOSSIBLE_ODOMETER" ||
      t.assemblyStatus === "METRICS_DELAYED" ||
      t.flags.includes("impossible_odometer") ||
      t.flags.includes("duplicate_trip_end") ||
      t.flags.includes("vin_from_assignment"),
  );

  const assignments = imei
    ? await db.deviceVehicleAssignment.findMany({
        where: { imei },
        orderBy: { startedAt: "asc" },
      })
    : [];

  return (
    <main className="w-full px-6 py-10 md:px-14 md:py-12">
      <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
        <span className="h-px w-[22px] bg-orange" />
        Ops
      </p>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
        Mileage <span className="text-orange">disputes.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-[0.9rem] leading-[1.7] font-light text-mid">
        Morning-email screen: trusted miles with provenance. We never invent or
        silently average odometer vs tripDistance. Feed VINs are a parallel
        dataset — not joined to marketplace cars.
      </p>

      <form
        method="get"
        className="mt-8 flex flex-wrap items-end gap-4 border border-rule p-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
            Device (IMEI)
          </span>
          <select
            name="imei"
            defaultValue={imei}
            className="min-w-[26rem] border border-rule-s bg-white px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
          >
            {devices.map((d) => (
              <option key={d.imei} value={d.imei}>
                …{d.imei.slice(-3)} ({d.imei})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
          />
        </label>
        <button
          type="submit"
          className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase hover:opacity-80"
        >
          Load
        </button>
      </form>

      {!imei ? (
        <p className="mt-8 text-mid">
          No devices yet. Run <code className="font-mono text-sm">npm run db:ingest</code>{" "}
          then <code className="font-mono text-sm">npm run db:assemble</code>.
        </p>
      ) : (
        <>
          <section className="mt-10 grid gap-4 border border-rule p-5 md:grid-cols-3">
            <div>
              <p className="font-mono text-[0.6rem] tracking-[0.14em] text-mid uppercase">
                Trips in view
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{trips.length}</p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] tracking-[0.14em] text-mid uppercase">
                Trusted miles (sum)
              </p>
              <p className="mt-1 text-2xl font-bold text-orange">
                {trustedSum.toFixed(1)} mi
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] tracking-[0.14em] text-mid uppercase">
                Flagged trips
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{flagged.length}</p>
            </div>
          </section>

          <section className="mt-8">
            <p className="mb-1 font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
              Device ↔ VIN assignments
            </p>
            <p className="mb-3 max-w-2xl text-[0.8rem] leading-relaxed font-light text-muted">
              One IMEI is usually on one VIN at a time. Assignments are
              time-bounded — a dongle can move cars (
              <span className="font-mono text-[0.75rem]">vinChange</span>
              ); closed rows end, the open row is current.
            </p>
            <div className="overflow-x-auto border border-rule">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-rule">
                  <tr>
                    <th className="px-4 py-2 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                      VIN
                    </th>
                    <th className="px-4 py-2 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                      Started
                    </th>
                    <th className="px-4 py-2 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                      Ended
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b border-rule last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{a.vin}</td>
                      <td className="px-4 py-2 font-mono text-xs text-mid">
                        {fmtTs(a.startedAt)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-mid">
                        {a.endedAt ? fmtTs(a.endedAt) : "open"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10">
            <p className="mb-3 font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
              Trips
            </p>
            {trips.length === 0 ? (
              <p className="text-mid">
                No trips for this filter.{" "}
                <Link href="/ops/disputes" className="text-orange hover:opacity-80">
                  Clear dates
                </Link>{" "}
                or run assemble.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {trips.map((t) => {
                  const md = t.mileageDecision;
                  const hot =
                    t.assemblyStatus === "IMPOSSIBLE_ODOMETER" ||
                    t.flags.includes("impossible_odometer");
                  return (
                    <article
                      key={t.id}
                      className={`border px-4 py-4 ${hot ? "border-orange" : "border-rule"}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-mono text-sm font-medium text-ink">
                          {t.transactionId}
                        </h2>
                        <span className="font-mono text-[0.65rem] tracking-[0.12em] text-orange uppercase">
                          {t.assemblyStatus}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[0.7rem] text-muted">
                        VIN {t.vin ?? "—"} · {fmtTs(t.startAt)} → {fmtTs(t.endAt)}
                      </p>
                      <p className="mt-1 font-mono text-[0.7rem] text-muted">
                        odo {fmtMi(t.startOdometer)} → {fmtMi(t.endOdometer)} ·
                        tripDistance {fmtMi(t.tripDistance)}
                      </p>
                      {t.flags.length > 0 ? (
                        <p className="mt-2 font-mono text-[0.65rem] text-mid">
                          flags: {t.flags.join(", ")}
                        </p>
                      ) : null}
                      {md ? (
                        <div className="mt-3 border-t border-rule pt-3">
                          <p className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                            Mileage decision · {md.source} ·{" "}
                            {fmtMi(md.trustedMiles)}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-mid">
                            {md.rationale}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
