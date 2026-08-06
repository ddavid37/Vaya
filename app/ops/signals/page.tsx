// Part 2 product sketch: connect tripMetrics into average speed + acceleration score (placeholders).

import { VehicleScanning } from "@/components/VehicleScanning";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

type MetricsPayload = {
  data?: {
    imei?: string;
    vin?: string;
    transactionId?: string;
    averageDriveSpeed?: number;
    maxSpeed?: number;
    hardAccelerationCounts?: number;
    hardBrakingCounts?: number;
  };
};

/** Placeholder 0–100 from per-trip hard accel/brake averages — not an insurer model. */
function accelerationScore(
  hardAccel: number,
  hardBrake: number,
  samples: number,
): number {
  if (samples <= 0) return 0;
  const a = hardAccel / samples;
  const b = hardBrake / samples;
  return Math.max(0, Math.min(100, Math.round(100 - a * 15 - b * 12)));
}

export default async function SignalsPage() {
  const devices = await db.device.findMany({ orderBy: { imei: "asc" } });
  const rawMetrics = await db.telemetryRaw.findMany({
    where: { event: "tripMetrics" },
    orderBy: { deliveredAt: "asc" },
  });

  const byImei = new Map<
    string,
    {
      samples: number;
      avgSpeedSum: number;
      hardAccel: number;
      hardBrake: number;
      vins: Set<string>;
    }
  >();

  for (const row of rawMetrics) {
    const payload = row.payload as unknown as MetricsPayload;
    const d = payload.data ?? {};
    const imei = d.imei ?? row.imei;
    if (!imei) continue;
    const bucket = byImei.get(imei) ?? {
      samples: 0,
      avgSpeedSum: 0,
      hardAccel: 0,
      hardBrake: 0,
      vins: new Set<string>(),
    };
    if (typeof d.averageDriveSpeed === "number") {
      bucket.avgSpeedSum += d.averageDriveSpeed;
      bucket.samples += 1;
    }
    if (typeof d.hardAccelerationCounts === "number") {
      bucket.hardAccel += d.hardAccelerationCounts;
    }
    if (typeof d.hardBrakingCounts === "number") {
      bucket.hardBrake += d.hardBrakingCounts;
    }
    if (typeof d.vin === "string") bucket.vins.add(d.vin);
    byImei.set(imei, bucket);
  }

  return (
    <main className="w-full px-6 py-10 md:px-14 md:py-12">
      <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
        <span className="h-px w-[22px] bg-orange" />
        Ops · Part 2
      </p>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
        Driving <span className="text-orange">signals.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-[0.9rem] leading-[1.7] font-light text-mid">
        Product sketch: how we connect feed{" "}
        <code className="font-mono text-[0.8rem]">tripMetrics</code> into
        insurance-adjacent metrics. Average speed uses real samples when
        present; acceleration score is a simple placeholder formula — not a
        pricing model.
      </p>
      <p className="mt-2 text-[0.8rem] text-muted">
        Related:{" "}
        <Link href="/ops/disputes" className="text-orange hover:opacity-80">
          Mileage review
        </Link>
      </p>

      <div className="mt-10 overflow-x-auto border border-rule">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule">
            <tr>
              <th className="px-4 py-3 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                Device
              </th>
              <th className="px-4 py-3 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                VIN(s)
              </th>
              <th className="px-4 py-3 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                Avg speed
              </th>
              <th className="px-4 py-3 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                Hard accel / brake
              </th>
              <th className="px-4 py-3 font-mono text-[0.6rem] font-normal tracking-[0.12em] text-mid uppercase">
                Acceleration score
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const b = byImei.get(d.imei);
              const avg =
                b && b.samples > 0
                  ? (b.avgSpeedSum / b.samples).toFixed(1)
                  : null;
              const score = b
                ? accelerationScore(b.hardAccel, b.hardBrake, b.samples)
                : null;
              return (
                <tr key={d.imei} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">
                    …{d.imei.slice(-3)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mid">
                    {b && b.vins.size > 0
                      ? [...b.vins].join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {avg != null ? (
                      <>
                        {avg} mph{" "}
                        <span className="text-muted">
                          ({b!.samples} samples)
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">placeholder —</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mid">
                    {b
                      ? `${b.hardAccel} / ${b.hardBrake}`
                      : "placeholder —"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {score != null ? (
                      <>
                        {score}{" "}
                        <span className="text-muted">(placeholder)</span>
                      </>
                    ) : (
                      <span className="text-muted">placeholder —</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-8 max-w-2xl border border-rule p-5">
        <p className="font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
          How this connects
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.85rem] leading-relaxed text-mid">
          <li>
            <strong className="font-medium text-ink">Average speed</strong> —
            mean of{" "}
            <code className="font-mono text-[0.75rem]">averageDriveSpeed</code>{" "}
            from webhook <code className="font-mono text-[0.75rem]">tripMetrics</code>.
          </li>
          <li>
            <strong className="font-medium text-ink">Hard accel / brake</strong>{" "}
            — sum of{" "}
            <code className="font-mono text-[0.75rem]">hardAccelerationCounts</code>{" "}
            /{" "}
            <code className="font-mono text-[0.75rem]">hardBrakingCounts</code>{" "}
            across those same <code className="font-mono text-[0.75rem]">tripMetrics</code>{" "}
            events.
          </li>
          <li>
            <strong className="font-medium text-ink">Acceleration score</strong>{" "}
            — placeholder from per-trip averages of those counts (not
            insurer-grade).
          </li>
          <li>
            Driver identity is still{" "}
            <strong className="font-medium text-ink">unknown</strong> in the
            feed — scores attach to device/VIN intervals, not a named person.
          </li>
        </ul>
      </section>

      <VehicleScanning />
    </main>
  );
}
