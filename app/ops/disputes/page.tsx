// Ops disputes: explain trusted trip miles for an IMEI (and optional period) without inventing data.

import { AiSummaryButton } from "@/components/AiSummaryButton";
import { HandoverEvidence } from "@/components/HandoverEvidence";
import { db } from "@/lib/db";
import {
  healthColor,
  healthFrameClass,
  scoreDrivingHealth,
  scoreVinDrivingHealth,
} from "@/lib/driving-health";
import { metricsByTransactionId } from "@/lib/trip-metrics-from-raw";
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

/** Seconds → m:ss (e.g. 40 → 0:40, 65 → 1:05). */
function fmtIdle(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
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

  const metricRows =
    trips.length > 0
      ? await db.telemetryRaw.findMany({
          where: {
            event: { in: ["tripEnd", "trip", "tripMetrics"] },
            transactionId: { in: trips.map((t) => t.transactionId) },
          },
          select: { event: true, transactionId: true, payload: true },
        })
      : [];
  const metricsMap = metricsByTransactionId(metricRows);

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

  const openVin =
    assignments.find((a) => a.endedAt == null)?.vin ??
    assignments[assignments.length - 1]?.vin ??
    "";

  const confirms = imei
    ? await db.manualMileageConfirm.findMany({
        where: openVin
          ? { OR: [{ imei }, { vin: openVin }] }
          : { imei },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];

  const vinHealthByVin = new Map<
    string,
    ReturnType<typeof scoreVinDrivingHealth>
  >();
  for (const a of assignments) {
    const vinTrips = trips
      .filter((t) => t.vin === a.vin)
      .map((t) => {
        const m = metricsMap.get(t.transactionId);
        const miles =
          t.mileageDecision?.trustedMiles != null
            ? Number(t.mileageDecision.trustedMiles.toString())
            : t.tripDistance != null
              ? Number(t.tripDistance.toString())
              : null;
        return {
          miles,
          fuelConsumed: m?.fuelConsumed ?? null,
          averageDriveSpeed: m?.averageDriveSpeed ?? null,
          hardBrakingCounts: m?.hardBrakingCounts ?? null,
          hardAccelerationCounts: m?.hardAccelerationCounts ?? null,
          totalIdlingTime: m?.totalIdlingTime ?? null,
          tripTime: m?.tripTime ?? null,
          assemblyStatus: t.assemblyStatus,
          flags: t.flags,
        };
      });
    vinHealthByVin.set(a.vin, scoreVinDrivingHealth(vinTrips));
  }

  return (
    <main className="w-full px-6 py-10 md:px-14 md:py-12">
      <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
        <span className="h-px w-[22px] bg-orange" />
        Ops
      </p>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
        Mileage <span className="text-orange">review.</span>
      </h1>

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
        <AiSummaryButton imei={imei} from={sp.from} to={sp.to} />
      </form>

      {!imei ? (
        <p className="mt-8 text-mid">
          No devices yet. Run <code className="font-mono text-sm">npm run db:ingest</code>{" "}
          then <code className="font-mono text-sm">npm run db:assemble</code>.
        </p>
      ) : (
        <>
          <HandoverEvidence
            imei={imei}
            defaultVin={openVin}
            confirms={confirms.map((c) => ({
              id: c.id,
              representorName: c.representorName,
              vin: c.vin,
              mileageRecorded: Number(c.mileageRecorded.toString()).toFixed(1),
              createdAt:
                c.createdAt.toISOString().replace("T", " ").slice(0, 16) + "Z",
            }))}
          />

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
              <p className="mt-1 text-2xl font-bold text-red-600">
                {flagged.length}
              </p>
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
                    <th className="px-4 py-2 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                      Overall driving health
                    </th>
                    <th className="px-4 py-2 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                      Mean metrics (in view)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const vh = vinHealthByVin.get(a.vin);
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-rule last:border-0 align-top"
                      >
                        <td className="px-4 py-2 font-mono text-xs">{a.vin}</td>
                        <td className="px-4 py-2 font-mono text-xs text-mid">
                          {fmtTs(a.startedAt)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-mid">
                          {a.endedAt ? fmtTs(a.endedAt) : "open"}
                        </td>
                        <td className="px-4 py-2">
                          {vh ? (
                            <>
                              <p
                                className={`font-mono text-xs uppercase ${healthColor(vh.health)}`}
                              >
                                {vh.health}
                              </p>
                              <p className="mt-1 max-w-md font-mono text-[0.65rem] leading-snug text-muted">
                                {vh.calculation}
                              </p>
                            </>
                          ) : (
                            <span className="font-mono text-xs text-muted">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-[0.7rem] text-ink">
                          {vh ? (
                            <>
                              <div>
                                avgSpeed {vh.meanSpeed != null ? `${vh.meanSpeed} mph` : "—"}
                              </div>
                              <div>
                                hardBrake {vh.meanHardBrake ?? "—"}
                              </div>
                              <div>
                                hardAccel {vh.meanHardAccel ?? "—"}
                              </div>
                              <div className="mt-1 text-muted">
                                {vh.scoredCount}/{vh.tripCount} trips scored
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
              <div className="flex flex-col gap-3">
                {trips.map((t) => {
                  const md = t.mileageDecision;
                  const miles =
                    md?.trustedMiles != null
                      ? Number(md.trustedMiles.toString())
                      : t.tripDistance != null
                        ? Number(t.tripDistance.toString())
                        : null;
                  const m = metricsMap.get(t.transactionId);
                  const fuel = m?.fuelConsumed ?? null;
                  const health = scoreDrivingHealth({
                    miles,
                    fuelConsumed: fuel,
                    averageDriveSpeed: m?.averageDriveSpeed ?? null,
                    hardBrakingCounts: m?.hardBrakingCounts ?? null,
                    hardAccelerationCounts: m?.hardAccelerationCounts ?? null,
                    totalIdlingTime: m?.totalIdlingTime ?? null,
                    tripTime: m?.tripTime ?? null,
                    assemblyStatus: t.assemblyStatus,
                    flags: t.flags,
                  });
                  return (
                    <article
                      key={t.id}
                      className={`w-full border-2 px-4 py-3 md:px-5 ${healthFrameClass(health.health)}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h2 className="font-mono text-sm font-medium text-ink">
                            {t.transactionId}
                          </h2>
                          <span className="font-mono text-[0.7rem] text-muted">
                            VIN {t.vin ?? "—"}
                          </span>
                          <span className="font-mono text-[0.7rem] text-muted">
                            {fmtTs(t.startAt)} → {fmtTs(t.endAt)}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[0.65rem] tracking-[0.12em] uppercase ${healthColor(health.health)}`}
                        >
                          {t.assemblyStatus}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 border-t border-rule pt-3 md:grid-cols-12 md:gap-4">
                        <div className="md:col-span-3">
                          <p className="font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                            Distance · fuel
                          </p>
                          <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-ink">
                            odo {fmtMi(t.startOdometer)} → {fmtMi(t.endOdometer)}
                          </p>
                          <p className="font-mono text-[0.7rem] text-muted">
                            tripDistance {fmtMi(t.tripDistance)}
                            {fuel != null ? ` · fuel ${fuel}` : ""}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-x-3">
                            <div>
                              <p className="font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                                Driver
                              </p>
                              <p className="mt-0.5 font-mono text-[0.7rem] text-ink">
                                unknown
                              </p>
                            </div>
                            <div>
                              <p className="font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                                Idle
                              </p>
                              <p className="mt-0.5 font-mono text-[0.7rem] text-ink">
                                {m?.totalIdlingTime != null
                                  ? fmtIdle(m.totalIdlingTime)
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <p className="font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                            Critical metrics
                          </p>
                          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[0.7rem] text-ink">
                            <dt className="text-muted">avgSpeed</dt>
                            <dd>
                              {m?.averageDriveSpeed != null
                                ? `${m.averageDriveSpeed} mph`
                                : "—"}
                            </dd>
                            <dt className="text-muted">hardBrake</dt>
                            <dd>
                              {m?.hardBrakingCounts != null
                                ? m.hardBrakingCounts
                                : "—"}
                            </dd>
                            <dt className="text-muted">hardAccel</dt>
                            <dd>
                              {m?.hardAccelerationCounts != null
                                ? m.hardAccelerationCounts
                                : "—"}
                            </dd>
                          </dl>
                        </div>

                        <div className="md:col-span-3">
                          <p className="font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                            Driving health
                          </p>
                          <p
                            className={`mt-1 font-mono text-[0.75rem] uppercase ${healthColor(health.health)}`}
                          >
                            {health.health}
                          </p>
                          <p className="mt-1 font-mono text-[0.65rem] leading-relaxed break-words text-muted">
                            {health.calculation}
                          </p>
                        </div>

                        <div className="md:col-span-3">
                          <p className="font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                            Mileage decision
                          </p>
                          {md ? (
                            <>
                              <p className="mt-1 font-mono text-[0.7rem] text-ink">
                                {md.source} · {fmtMi(md.trustedMiles)}
                              </p>
                              <p className="mt-1 text-[0.75rem] leading-snug text-mid">
                                {md.rationale}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 font-mono text-[0.7rem] text-muted">
                              —
                            </p>
                          )}
                          {t.flags.length > 0 ? (
                            <p className="mt-2 font-mono text-[0.6rem] leading-snug text-mid">
                              flags: {t.flags.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
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
