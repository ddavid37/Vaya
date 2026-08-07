// Shared Prisma client singleton for server-side DB access.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse across hot reloads (dev) and warm serverless isolates (prod).
globalForPrisma.prisma = db;
