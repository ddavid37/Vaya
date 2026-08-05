import type { Metadata } from "next";
import { DM_Mono, Outfit } from "next/font/google";
import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/components/AuthButtons";
import { EstClock } from "@/components/EstClock";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vaya",
  description: "Car subscription marketplace",
};

const navLink =
  "font-mono text-[0.65rem] tracking-[0.16em] uppercase text-mid no-underline hover:text-orange focus-visible:text-orange focus-visible:outline-none transition-colors";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-white font-sans text-ink antialiased">
        <header className="border-b border-rule">
          <div className="flex w-full items-center justify-between gap-4 px-6 py-5 md:px-14 md:py-6">
            <Link href="/" className="no-underline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/vaya-logo.svg"
                alt="Vaya"
                width={90}
                height={23}
                className="h-[18px] w-auto md:h-[23px]"
              />
            </Link>
            <div className="flex items-center gap-4 md:gap-6">
              <nav className="flex items-center gap-2 md:gap-4">
                <Link href="/" className={navLink}>
                  Marketplace
                </Link>
                <span className="text-muted text-[0.6rem]">|</span>
                <Link href="/mine" className={navLink}>
                  My cars
                </Link>
                <span className="text-muted text-[0.6rem]">|</span>
                <Link href="/ops" className={navLink}>
                  Ops
                </Link>
                <span className="text-muted text-[0.6rem]">|</span>
                <Link href="/ops/conflicts" className={navLink}>
                  Conflicts
                </Link>
              </nav>
              {session?.user ? (
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-3">
                    <span className="hidden text-right sm:block">
                      <span className="block font-mono text-[0.6rem] tracking-[0.1em] text-ink uppercase">
                        {session.user.name ?? "Signed in"}
                      </span>
                      {session.user.email ? (
                        <span className="block font-mono text-[0.6rem] normal-case tracking-normal text-mid">
                          {session.user.email}
                        </span>
                      ) : null}
                    </span>
                    <SignOutButton />
                  </div>
                  <EstClock />
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1.5">
                  <SignInButton />
                  <EstClock />
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
