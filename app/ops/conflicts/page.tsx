import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  const conflicts = await db.dataConflict.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ops · Conflicts</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Seed/runtime integrity flags. We quarantine — we do not silently rewrite.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Subjects</th>
              <th className="px-4 py-3 font-medium">Resolution</th>
              <th className="px-4 py-3 font-medium">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-4 py-3 font-medium">{c.type}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {c.subjectIds.join(", ")}
                </td>
                <td className="px-4 py-3 text-neutral-700">{c.resolution}</td>
                <td className="px-4 py-3 text-neutral-600">{c.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
