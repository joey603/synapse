import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

/** Une seule requête SQL pour les `include`, au lieu d'un aller-retour par relation. */
export const join = { relationLoadStrategy: "join" as const };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

const TRANSIENT = new Set(["P1001", "P1008", "P1017", "P2024"]);

export async function withDbRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isTransient(error)) throw error;
    await db.$disconnect().catch(() => undefined);
    return run();
  }
}

function isTransient(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT.has(error.code);
}
