import { EarlyEndButtons } from "@/components/EarlyEndButtons";
import { db } from "@/lib/db";

const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const vehicles = await db.vehicle.findMany({
    include: {
      dealer: true,
      subscriptions: {
        where: { status: { in: [...LIVE, "CONFLICTING"] } },
        include: {
          driver: true,
          plan: true,
          ledgerEntries: { orderBy: { createdAt: "desc" }, take: 6 },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const conflictSubjects = new Set(
    (await db.dataConflict.findMany({ select: { subjectIds: true } })).flatMap(
      (c) => c.subjectIds,
    ),
  );

  return (
    <main className="w-full px-6 py-10 md:px-14 md:py-12">
      <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
        <span className="h-px w-[22px] bg-orange" />
        Ops
      </p>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
        Fleet <span className="text-orange">truth.</span>
      </h1>
      <p className="mt-3 max-w-xl text-[0.9rem] leading-[1.7] font-light text-mid">
        Live commitment is the lock — not <code className="font-mono text-[0.8rem]">vehicles.status</code> alone.
      </p>

      <div className="mt-8 w-full overflow-x-auto border border-rule">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule">
            <tr>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Vehicle
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Row status
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Live / conflict
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const live = v.subscriptions.filter((s) =>
                LIVE.includes(s.status as (typeof LIVE)[number]),
              );
              const conflicting = v.subscriptions.filter(
                (s) => s.status === "CONFLICTING",
              );
              const hasConflictBadge =
                conflictSubjects.has(v.id) ||
                v.subscriptions.some((s) => conflictSubjects.has(s.id));
              const derived =
                live[0]?.status ??
                (v.status === "PENDING_INTAKE" ? "PENDING" : "FREE");

              return (
                <tr
                  key={v.id}
                  className="border-b border-rule align-top last:border-0"
                >
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-ink">
                      {v.id} · {v.make} {v.model}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.7rem] text-muted">
                      {v.dealer.name} · …{v.vin.slice(-6)}
                      {hasConflictBadge ? (
                        <span className="ml-2 border border-orange/30 bg-orange/10 px-1.5 py-0.5 text-orange">
                          conflict
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[0.75rem] text-mid">
                    {v.status}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-ink">{derived}</div>
                    {live.map((s) => (
                      <div key={s.id} className="mt-1 text-xs text-mid">
                        {s.id} · {s.driver.firstName} {s.driver.lastName} · $
                        {s.monthlyPrice.toString()} · {s.milesThisPeriod} mi
                        {s.ledgerEntries.length > 0 ? (
                          <ul className="mt-1 list-disc pl-4 text-muted">
                            {s.ledgerEntries.map((l) => (
                              <li key={l.id}>{l.explanation}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                    {conflicting.map((s) => (
                      <div key={s.id} className="mt-1 text-xs text-orange">
                        {s.id} CONFLICTING (quarantined)
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3.5">
                    {live[0] ? (
                      <EarlyEndButtons subscriptionId={live[0].id} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
