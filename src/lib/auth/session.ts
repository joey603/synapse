import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";
import { cache } from "react";

import { audit } from "@/lib/audit";
import { LOCKOUT_AFTER, LOCKOUT_WINDOW_MS, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db, withDbRetry } from "@/lib/db";
import { logger } from "@/lib/logger";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "NURSE" | "ADMIN";
};

export type SessionLookup =
  | { status: "anonymous" }
  | { status: "invalid" }
  | { status: "ok"; user: SessionUser };

type LoginResult =
  | { ok: true; token: string }
  | { ok: false; code: "invalid" | "locked" };

let dummyHash: Promise<string> | null = null;

export const getSession = cache(loadSession);

async function loadSession(): Promise<SessionLookup> {
  const token = await readSessionCookie();
  if (!token) return { status: "anonymous" };

  try {
    const sessionToken = hashSessionToken(token);
    const row = await withDbRetry(() =>
      db.session.findUnique({
        where: { sessionToken },
        select: {
          id: true,
          expires: true,
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    );

    if (!row) return { status: "invalid" };

    if (row.expires.getTime() <= Date.now()) {
      await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
      return { status: "invalid" };
    }

    return { status: "ok", user: row.user };
  } catch (error) {
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown";
    logger.info("auth.session_lookup_failed", { code });
    return { status: "invalid" };
  }
}

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const normalized = normalizeEmail(email);

  if (!normalized || password.length === 0 || password.length > 128) {
    return { ok: false, code: "invalid" };
  }

  try {
    const [lockedForMs, user] = await Promise.all([
      lockoutRemainingMs(normalized),
      db.user.findUnique({
        where: { email: normalized },
        select: { id: true, passwordHash: true },
      }),
    ]);

    if (lockedForMs > 0) {
      logger.info("auth.login", { result: "locked" });
      return { ok: false, code: "locked" };
    }

    const passwordOk = await verifyPassword(
      user?.passwordHash ?? (await getDummyHash()),
      password,
    );

    if (!user || !passwordOk) {
      await audit({
        action: "LOGIN_FAILURE",
        entityType: "User",
        metadata: { email: normalized },
      });
      logger.info("auth.login", { result: "failure" });
      return { ok: false, code: "invalid" };
    }

    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await db.session.create({
      data: {
        sessionToken: hashSessionToken(token),
        userId: user.id,
        expires,
      },
    });

    after(() =>
      audit({
        actorId: user.id,
        action: "LOGIN_SUCCESS",
        entityType: "User",
        entityId: user.id,
        metadata: { email: normalized },
      }).catch(() => logger.error("auth.login_audit_failed")),
    );
    logger.info("auth.login", { result: "success" });

    return { ok: true, token };
  } catch {
    logger.error("auth.login_failed");
    return { ok: false, code: "invalid" };
  }
}

export async function destroyCurrentSession() {
  const token = await readSessionCookie();
  if (!token) return;

  try {
    const sessionToken = hashSessionToken(token);
    const row = await db.session.delete({
      where: { sessionToken },
      select: { id: true, userId: true },
    });

    after(() =>
      audit({
        actorId: row.userId,
        action: "LOGOUT",
        entityType: "Session",
        entityId: row.id,
      }).catch(() => logger.error("auth.logout_audit_failed")),
    );
    logger.info("auth.logout");
  } catch (error) {
    if (isNotFound(error)) return;
    logger.error("auth.logout_failed");
  }
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function appUrl(request: Request, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return new URL(path, `${proto}://${host}`);
}

async function readSessionCookie() {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

function hashSessionToken(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET manquant");
  }

  return createHmac("sha256", secret).update(token).digest("hex");
}

function normalizeEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!value || value.length > 254 || !value.includes("@")) return null;
  return value;
}

async function getDummyHash() {
  dummyHash ??= hashPassword("synapse-not-a-user");
  return dummyHash;
}

async function lockoutRemainingMs(email: string) {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const events = await db.auditLog.findMany({
    where: {
      action: { in: ["LOGIN_FAILURE", "LOGIN_SUCCESS"] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, createdAt: true, metadata: true },
    take: 40,
  });

  const mine = events.filter((event) => readEmail(event.metadata) === email);
  const failures: Date[] = [];

  for (const event of mine) {
    if (event.action === "LOGIN_SUCCESS") break;
    failures.push(event.createdAt);
  }

  if (failures.length < LOCKOUT_AFTER) return 0;

  const extra = failures.length - LOCKOUT_AFTER;
  const lockMs = Math.min(LOCKOUT_WINDOW_MS, 60_000 * 2 ** extra);
  const lastFailure = failures[0];
  return Math.max(0, lastFailure.getTime() + lockMs - Date.now());
}

function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function readEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const email = (metadata as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}
