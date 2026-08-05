import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  const conflicts = await db.dataConflict.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="w-full px-6 py-10 md:px-14 md:py-12">
      <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
        <span className="h-px w-[22px] bg-orange" />
        Ops
      </p>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
        Conflicts <span className="text-orange">quarantine.</span>
      </h1>
      <p className="mt-3 max-w-xl text-[0.9rem] leading-[1.7] font-light text-mid">
        Seed/runtime integrity flags. We quarantine — we do not silently rewrite.
      </p>

      <div className="mt-8 w-full overflow-x-auto border border-rule">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule">
            <tr>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Type
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Subjects
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Resolution
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                Rationale
              </th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c) => (
              <tr
                key={c.id}
                className="border-b border-rule align-top last:border-0"
              >
                <td className="px-4 py-3.5 font-medium text-ink">{c.type}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-mid">
                  {c.subjectIds.join(", ")}
                </td>
                <td className="px-4 py-3.5 text-mid">{c.resolution}</td>
                <td className="px-4 py-3.5 text-mid">{c.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
