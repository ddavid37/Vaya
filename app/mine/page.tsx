import { auth } from "@/auth";
import { SignInButton } from "@/components/AuthButtons";
import { db } from "@/lib/db";
import Link from "next/link";

const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;

export const dynamic = "force-dynamic";

export default async function MyCarsPage() {
  const session = await auth();

  if (!session?.driverId) {
    return (
      <main className="w-full px-6 py-10 md:px-14 md:py-12">
        <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
          <span className="h-px w-[22px] bg-orange" />
          My cars
        </p>
        <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
          Your <span className="text-orange">commitments.</span>
        </h1>
        <p className="mt-3 max-w-xl text-[0.9rem] leading-[1.7] font-light text-mid">
          Sign in with Google to see cars you&apos;ve committed to.
        </p>
        <div className="mt-6">
          <SignInButton />
        </div>
      </main>
    );
  }

  const subscriptions = await db.subscription.findMany({
    where: {
      driverId: session.driverId,
      status: { in: [...LIVE] },
    },
    include: {
      vehicle: { include: { dealer: true } },
      plan: true,
    },
    orderBy: { startDate: "desc" },
  });

  const monthlyTotal = subscriptions
    .reduce((sum, s) => sum + Number(s.monthlyPrice), 0)
    .toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  return (
    <main className="w-full px-6 py-10 md:px-14 md:py-12">
      <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
        <span className="h-px w-[22px] bg-orange" />
        My cars
      </p>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
        Your <span className="text-orange">commitments.</span>
      </h1>
      <p className="mt-3 max-w-xl text-[0.9rem] leading-[1.7] font-light text-mid">
        Live subscriptions for this Google account — the cars you hold right
        now. Not a cart: once committed, the vehicle leaves the marketplace.
      </p>

      {subscriptions.length === 0 ? (
        <div className="mt-10 border border-rule px-6 py-10">
          <p className="text-mid">No live commitments yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase hover:opacity-80"
          >
            Browse marketplace →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 w-full overflow-x-auto border border-rule">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rule">
                <tr>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Vehicle
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Plan / price
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-rule last:border-0"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-ink">
                        {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.7rem] text-muted">
                        {s.vehicle.id} · VIN {s.vehicle.vin} ·{" "}
                        {s.vehicle.dealer.city}, {s.vehicle.dealer.state}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.7rem] text-muted">
                        {s.id}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[0.75rem] text-orange">
                      {s.status}
                    </td>
                    <td className="px-4 py-3.5 text-ink">
                      <div>
                        {s.plan.name} {s.plan.tier}
                      </div>
                      <div className="font-mono text-[0.7rem] text-muted">
                        ${s.monthlyPrice.toString()}/mo
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[0.75rem] text-mid">
                      {s.startDate.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-16 border-t border-rule pt-10 md:mt-24 md:pt-14">
            <p className="mb-3 font-mono text-[0.68rem] tracking-[0.22em] text-mid uppercase">
              Total
            </p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[0.9rem] font-light text-mid">
                  {subscriptions.length === 1
                    ? "1 live subscription"
                    : `${subscriptions.length} live subscriptions`}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Sum of monthly prices on this account (snapshot at commit).
                </p>
              </div>
              <p className="text-[clamp(2rem,5vw,3.5rem)] leading-none font-bold tracking-[-0.04em] text-orange">
                ${monthlyTotal}
                <span className="ml-1 font-mono text-[0.7rem] font-normal tracking-[0.14em] text-mid uppercase">
                  /mo
                </span>
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
