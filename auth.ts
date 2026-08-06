// Auth.js Google login: upsert Driver from profile and put driverId on the session JWT.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { NextAuthConfig } from "next-auth";

async function upsertDriverFromGoogle(email: string, name?: string | null) {
  const normalized = email.toLowerCase();
  const existing = await db.driver.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (existing) return existing;

  const parts = (name ?? normalized).trim().split(/\s+/);
  const firstName = parts[0] || "Driver";
  const lastName = parts.slice(1).join(" ") || "Google";
  const id = `drv-${createHash("sha256").update(normalized).digest("hex").slice(0, 12)}`;

  return db.driver.create({
    data: {
      id,
      email: normalized,
      firstName,
      lastName,
      phone: null,
      licenseState: "XX",
      createdAt: new Date(),
    },
  });
}

const config = {
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, profile }) {
      const email = (profile?.email ?? token.email)?.toLowerCase();
      if (!email) return token;
      token.email = email;

      if (!token.driverId) {
        const driver = await upsertDriverFromGoogle(email, profile?.name ?? token.name);
        token.driverId = driver.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.driverId === "string") {
        session.driverId = token.driverId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
