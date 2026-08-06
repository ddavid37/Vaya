// App header: one audience at a time (Driver vs Operator) with a switch next to auth.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type AppView = "driver" | "operator";

const navLink =
  "font-mono text-[0.65rem] tracking-[0.16em] uppercase text-mid no-underline hover:text-orange focus-visible:text-orange focus-visible:outline-none transition-colors";

const switchBtn =
  "border border-rule-s px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-mid uppercase transition-colors hover:border-orange hover:text-orange";

export function AppHeader({
  authRow,
  clock,
}: {
  authRow: React.ReactNode;
  clock: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const view: AppView = pathname.startsWith("/ops") ? "operator" : "driver";

  function switchView() {
    router.push(view === "driver" ? "/ops" : "/");
  }

  return (
    <header className="border-b border-rule">
      <div className="flex w-full items-center justify-between gap-4 px-6 py-5 md:px-14 md:py-6">
        <Link href={view === "driver" ? "/" : "/ops"} className="no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vaya-logo.svg"
            alt="Vaya"
            width={90}
            height={23}
            className="h-[18px] w-auto md:h-[23px]"
          />
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 md:gap-6">
          <nav
            className="flex flex-wrap items-center justify-end gap-2 md:gap-3"
            aria-label={view === "driver" ? "Driver view" : "Operator view"}
          >
            <span className="font-mono text-[0.65rem] tracking-[0.16em] text-orange uppercase">
              {view === "driver" ? "Driver view" : "Operator view"}
            </span>
            {view === "driver" ? (
              <>
                <Link href="/" className={navLink}>
                  Marketplace
                </Link>
                <Link href="/mine" className={navLink}>
                  My cars
                </Link>
              </>
            ) : (
              <>
                <Link href="/ops" className={navLink}>
                  Fleet
                </Link>
                <Link href="/ops/conflicts" className={navLink}>
                  Conflicts
                </Link>
                <Link href="/ops/disputes" className={navLink}>
                  Disputes
                </Link>
              </>
            )}
          </nav>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
              {authRow}
              <button
                type="button"
                onClick={switchView}
                className={switchBtn}
                aria-label={
                  view === "driver"
                    ? "Switch to Operator view"
                    : "Switch to Driver view"
                }
              >
                {view === "driver" ? "Operator view" : "Driver view"}
              </button>
            </div>
            {clock}
          </div>
        </div>
      </div>
    </header>
  );
}
