// Root layout: brand shell, audience-scoped nav, Google auth controls, EST clock.

import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Mono, Outfit } from "next/font/google";
import { auth } from "@/auth";
import { AiChatFab } from "@/components/AiChatFab";
import { AppHeader } from "@/components/AppHeader";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  const userLabel = session?.user ? (
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
  ) : null;

  const authButton = session?.user ? <SignOutButton /> : <SignInButton />;

  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-white font-sans text-ink antialiased">
        <AppHeader
          userLabel={userLabel}
          authButton={authButton}
          clock={<EstClock />}
        />
        {children}
        <Suspense fallback={null}>
          <AiChatFab />
        </Suspense>
      </body>
    </html>
  );
}
