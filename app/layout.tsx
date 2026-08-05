import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaya",
  description: "Car subscription marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Vaya
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-600">
              <Link href="/" className="hover:text-neutral-900">
                Marketplace
              </Link>
              <Link href="/ops" className="hover:text-neutral-900">
                Ops
              </Link>
              <Link href="/ops/conflicts" className="hover:text-neutral-900">
                Conflicts
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
