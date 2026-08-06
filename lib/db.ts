// Shared Prisma client singleton for server-side DB access.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Drop a stale global client after `prisma generate` adds new models (dev HMR). */
function client(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && "manualMileageConfirm" in existing) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect();
  }
  const next = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = next;
  }
  return next;
}

export const db = client();
