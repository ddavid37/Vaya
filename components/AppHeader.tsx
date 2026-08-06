// App header: centered audience title, active tab highlight, view switch left of Sign out.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type AppView = "driver" | "operator";

const tabIdle =
  "font-mono text-[0.65rem] tracking-[0.16em] uppercase text-mid no-underline hover:text-orange focus-visible:text-orange focus-visible:outline-none transition-colors";
const tabActive =
  "font-mono text-[0.65rem] tracking-[0.16em] uppercase text-orange no-underline focus-visible:outline-none";

const switchBtn =
  "border border-rule-s px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-mid uppercase transition-colors hover:border-orange hover:text-orange";

function tabClass(active: boolean) {
  return active ? tabActive : tabIdle;
}

export function AppHeader({
  userLabel,
  authButton,
  clock,
}: {
  userLabel: React.ReactNode;
  authButton: React.ReactNode;
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
      <div className="relative grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-5 md:gap-4 md:px-14 md:py-6">
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Link
            href={view === "driver" ? "/" : "/ops"}
            className="shrink-0 no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vaya-logo.svg"
              alt="Vaya"
              width={90}
              height={23}
              className="h-[18px] w-auto md:h-[23px]"
            />
          </Link>
          <nav
            className="flex flex-wrap items-center gap-2 md:gap-3"
            aria-label={view === "driver" ? "Driver tabs" : "Operator tabs"}
          >
            {view === "driver" ? (
              <>
                <Link
                  href="/"
                  className={tabClass(pathname === "/")}
                  aria-current={pathname === "/" ? "page" : undefined}
                >
                  Marketplace
                </Link>
                <Link
                  href="/mine"
                  className={tabClass(pathname.startsWith("/mine"))}
                  aria-current={
                    pathname.startsWith("/mine") ? "page" : undefined
                  }
                >
                  My cars
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/ops"
                  className={tabClass(
                    pathname === "/ops" || pathname === "/ops/",
                  )}
                  aria-current={
                    pathname === "/ops" || pathname === "/ops/"
                      ? "page"
                      : undefined
                  }
                >
                  Fleet
                </Link>
                <Link
                  href="/ops/conflicts"
                  className={tabClass(pathname.startsWith("/ops/conflicts"))}
                  aria-current={
                    pathname.startsWith("/ops/conflicts") ? "page" : undefined
                  }
                >
                  Conflicts
                </Link>
                <Link
                  href="/ops/disputes"
                  className={tabClass(pathname.startsWith("/ops/disputes"))}
                  aria-current={
                    pathname.startsWith("/ops/disputes") ? "page" : undefined
                  }
                >
                  Disputes
                </Link>
              </>
            )}
          </nav>
        </div>

        <h1 className="pointer-events-none text-center font-sans text-[1.15rem] leading-none font-bold tracking-[-0.02em] text-ink uppercase md:text-[1.5rem] lg:text-[1.75rem]">
          {view === "driver" ? "Driver view" : "Operator view"}
        </h1>

        <div className="flex flex-col items-end gap-1.5 justify-self-end">
          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            {userLabel}
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
            {authButton}
          </div>
          {clock}
        </div>
      </div>
    </header>
  );
}
