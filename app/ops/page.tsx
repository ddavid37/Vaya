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
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ops · Fleet</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Live commitment is the lock — not <code>vehicles.status</code> alone.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Row status</th>
              <th className="px-4 py-3 font-medium">Live / conflict</th>
              <th className="px-4 py-3 font-medium">Actions</th>
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
                live[0]?.status ?? (v.status === "PENDING_INTAKE" ? "PENDING" : "FREE");

              return (
                <tr key={v.id} className="border-b border-neutral-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {v.id} · {v.make} {v.model}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {v.dealer.name} · …{v.vin.slice(-6)}
                      {hasConflictBadge ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                          conflict
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">{v.status}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{derived}</div>
                    {live.map((s) => (
                      <div key={s.id} className="mt-1 text-xs text-neutral-600">
                        {s.id} · {s.driver.firstName} {s.driver.lastName} · $
                        {s.monthlyPrice.toString()} · {s.milesThisPeriod} mi
                        {s.ledgerEntries.length > 0 ? (
                          <ul className="mt-1 list-disc pl-4 text-neutral-500">
                            {s.ledgerEntries.map((l) => (
                              <li key={l.id}>{l.explanation}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                    {conflicting.map((s) => (
                      <div key={s.id} className="mt-1 text-xs text-amber-800">
                        {s.id} CONFLICTING (quarantined)
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    {live[0] ? (
                      <EarlyEndButtons subscriptionId={live[0].id} />
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
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
