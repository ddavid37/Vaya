// My cars: signed-in driver’s commitments, early-end manage UI, ledger, monthly total.

import { auth } from "@/auth";
import { SignInButton } from "@/components/AuthButtons";
import { ManageSubscription } from "@/components/ManageSubscription";
import { db } from "@/lib/db";
import Link from "next/link";

const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;
const MINE = [...LIVE, "ENDED"] as const;

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
      status: { in: [...MINE] },
    },
    include: {
      vehicle: { include: { dealer: true } },
      plan: true,
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 12 },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });

  const live = subscriptions.filter((s) =>
    LIVE.includes(s.status as (typeof LIVE)[number]),
  );
  const monthlyTotal = live
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
        Your Google account only — not the whole fleet. Manage early end here;
        Ops stays the full-fleet / conflict screen.
      </p>

      {subscriptions.length === 0 ? (
        <div className="mt-10 border border-rule px-6 py-10">
          <p className="text-mid">No commitments yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase hover:opacity-80"
          >
            Browse marketplace →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-8">
            {subscriptions.map((s) => (
              <article
                key={s.id}
                className="border border-rule px-5 py-5 md:px-6 md:py-6"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase">
                      {s.status}
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-ink uppercase md:text-2xl">
                      {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}
                    </h2>
                    <p className="mt-2 font-mono text-[0.7rem] text-muted">
                      {s.vehicle.id} · VIN {s.vehicle.vin} ·{" "}
                      {s.vehicle.dealer.city}, {s.vehicle.dealer.state}
                    </p>
                    <p className="mt-1 font-mono text-[0.7rem] text-muted">
                      {s.id} · {s.plan.name} {s.plan.tier} · $
                      {s.monthlyPrice.toString()}/mo · started{" "}
                      {s.startDate.toISOString().slice(0, 10)}
                      {s.endDate
                        ? ` · end ${s.endDate.toISOString().slice(0, 10)}`
                        : ""}
                    </p>

                    {s.ledgerEntries.length > 0 ? (
                      <div className="mt-5">
                        <p className="mb-2 font-mono text-[0.6rem] tracking-[0.14em] text-mid uppercase">
                          What&apos;s owed (ledger)
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-mid">
                          {s.ledgerEntries.map((l) => (
                            <li key={l.id}>{l.explanation}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-5 text-sm text-muted">
                        No ledger lines yet — schedule or end to record what&apos;s
                        owed.
                      </p>
                    )}
                  </div>

                  <div className="w-full shrink-0 lg:max-w-xs">
                    <ManageSubscription
                      subscriptionId={s.id}
                      status={s.status}
                      currentEndDate={
                        s.endDate ? s.endDate.toISOString().slice(0, 10) : null
                      }
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="mt-16 border-t border-rule pt-10 text-center md:mt-24 md:pt-14">
            <p className="mb-3 font-mono text-[0.68rem] tracking-[0.22em] text-mid uppercase">
              Total (live only)
            </p>
            <p className="text-[clamp(2rem,5vw,3.5rem)] leading-none font-bold tracking-[-0.04em] text-orange">
              ${monthlyTotal}
              <span className="ml-1 font-mono text-[0.7rem] font-normal tracking-[0.14em] text-mid uppercase">
                /mo
              </span>
            </p>
            <p className="mt-4 text-[0.9rem] font-light text-mid">
              {live.length === 1
                ? "1 live subscription"
                : `${live.length} live subscriptions`}
              {subscriptions.length > live.length
                ? ` · ${subscriptions.length - live.length} ended shown for ledger`
                : null}
            </p>
            <p className="mt-1 text-sm text-muted">
              Sum of monthly prices on live commitments only.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
