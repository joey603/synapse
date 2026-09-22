import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    // Sur Vercel, 1 connexion par isolate évite d’épuiser le pooler Supabase.
    if (process.env.VERCEL) {
      url.searchParams.set("connection_limit", "1");
      if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
      if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Toujours réutiliser le client (dev HMR + isolates Next).
globalForPrisma.prisma = db;

const TRANSIENT = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isTransientDbError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT.has(error.code)) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /timed out fetching a new connection|can't reach database|connection pool|ECONNRESET|ECONNREFUSED|P1001|P2024/i.test(
    message,
  );
}

export async function withDbRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (!isTransientDbError(error) || attempt === attempts - 1) throw error;
      await db.$disconnect().catch(() => undefined);
      await sleep(60 * (attempt + 1));
    }
  }
  throw last;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Une seule requête SQL pour les `include`, au lieu d'un aller-retour par relation. */
export const join = { relationLoadStrategy: "join" as const };
