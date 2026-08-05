import { CommitForm } from "@/components/CommitForm";
import { db } from "@/lib/db";

const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const [vehicles, plans, drivers] = await Promise.all([
    db.vehicle.findMany({
      include: {
        dealer: true,
        subscriptions: { where: { status: { in: [...LIVE] } } },
      },
      orderBy: { id: "asc" },
    }),
    db.plan.findMany({ orderBy: { basePrice: "asc" } }),
    db.driver.findMany({
      include: {
        subscriptions: { where: { status: { in: [...LIVE] } } },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const bookable = vehicles.filter(
    (v) => v.status !== "PENDING_INTAKE" && v.subscriptions.length === 0,
  );
  const driver =
    drivers.find((d) => d.subscriptions.length === 0) ?? drivers[0] ?? null;

  const planOptions = plans.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    basePrice: p.basePrice.toString(),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Bookable cars only (no live commitment, not pending intake).
        {driver ? (
          <>
            {" "}
            Committing as{" "}
            <span className="font-medium text-neutral-800">
              {driver.firstName} {driver.lastName}
            </span>{" "}
            ({driver.id}).
          </>
        ) : null}
      </p>

      {bookable.length === 0 ? (
        <p className="mt-8 text-neutral-600">No bookable vehicles right now.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Dealer</th>
                <th className="px-4 py-3 font-medium">List price</th>
                <th className="px-4 py-3 font-medium">Commit</th>
              </tr>
            </thead>
            <tbody>
              {bookable.map((v) => (
                <tr key={v.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {v.year} {v.make} {v.model}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {v.id} · …{v.vin.slice(-6)} · {v.odometer.toLocaleString()} mi
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {v.dealer.city}, {v.dealer.state}
                  </td>
                  <td className="px-4 py-3">
                    {v.monthlyPrice != null ? `$${v.monthlyPrice}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {driver ? (
                      <CommitForm
                        vehicleId={v.id}
                        driverId={driver.id}
                        plans={planOptions}
                      />
                    ) : (
                      <span className="text-neutral-500">No driver</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
