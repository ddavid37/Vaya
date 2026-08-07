// Driver marketplace: list bookable cars and commit under the signed-in driver.

import { auth } from "@/auth";
import { CommitForm } from "@/components/CommitForm";
import { PictureButton } from "@/components/PictureButton";
import { SignInButton } from "@/components/AuthButtons";
import { db } from "@/lib/db";
import carIllustration from "../assets/car-illustration.png";
import Image from "next/image";

const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const session = await auth();

  const [bookable, plans, driver] = await Promise.all([
    // Only cars that can be committed — smaller query after Google redirect.
    db.vehicle.findMany({
      where: {
        status: { not: "PENDING_INTAKE" },
        subscriptions: { none: { status: { in: [...LIVE] } } },
      },
      include: { dealer: true },
      orderBy: { id: "asc" },
    }),
    db.plan.findMany({ orderBy: { basePrice: "asc" } }),
    session?.driverId
      ? db.driver.findUnique({ where: { id: session.driverId } })
      : Promise.resolve(null),
  ]);

  const planOptions = plans.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    basePrice: p.basePrice.toString(),
  }));

  return (
    <main className="w-full">
      <section className="grid w-full grid-cols-1 items-center gap-8 border-b border-rule px-6 py-10 md:grid-cols-2 md:gap-12 md:px-14 md:py-12">
        <div>
          <p className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.22em] text-orange uppercase">
            <span className="h-px w-[22px] bg-orange" />
            Marketplace
          </p>
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.95] font-bold tracking-[-0.01em] text-ink uppercase">
            Bookable cars.
            <br />
            <span className="text-orange">One commitment each.</span>
          </h1>
          <p className="mt-5 max-w-md text-[0.9rem] leading-[1.7] font-light text-mid">
            Free cars only — no live commitment, not pending intake.
            {driver ? (
              <>
                {" "}
                Signed in as{" "}
                <span className="font-medium text-ink">
                  {driver.firstName} {driver.lastName}
                </span>{" "}
                · <span className="text-ink">{driver.email}</span> (
                {driver.id}).
              </>
            ) : (
              <> Sign in with Google to commit.</>
            )}
          </p>
          {!driver ? (
            <div className="mt-6">
              <SignInButton />
            </div>
          ) : null}
        </div>
        <div className="w-full max-w-xl justify-self-end md:max-w-none">
          <Image
            src={carIllustration}
            alt="Vaya car illustration"
            width={1600}
            height={600}
            className="h-auto w-full"
            priority
          />
        </div>
      </section>

      <section className="w-full px-6 py-8 md:px-14 md:py-10">
        {bookable.length === 0 ? (
          <p className="text-mid">No bookable vehicles right now.</p>
        ) : (
          <div className="w-full overflow-x-auto border border-rule">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rule">
                <tr>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Vehicle
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Dealer
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    List price
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Picture
                  </th>
                  <th className="px-4 py-3 font-mono text-[0.65rem] font-normal tracking-[0.14em] text-mid uppercase">
                    Commit
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookable.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-rule last:border-0"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-ink">
                        {v.year} {v.make} {v.model}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.7rem] text-muted">
                        {v.id} · VIN {v.vin} · {Number(v.odometer)} mi
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-mid">
                      {v.dealer.city}, {v.dealer.state}
                    </td>
                    <td className="px-4 py-3.5 text-ink">
                      {v.monthlyPrice != null ? `$${v.monthlyPrice}` : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <PictureButton
                        vehicleLabel={`${v.year} ${v.make} ${v.model}`}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      {driver ? (
                        <CommitForm vehicleId={v.id} plans={planOptions} />
                      ) : (
                        <span className="font-mono text-[0.65rem] tracking-[0.12em] text-muted uppercase">
                          Sign in to commit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
