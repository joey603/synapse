import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";
import { cache } from "react";

import { audit } from "@/lib/audit";
import {
  LOCKOUT_AFTER,
  LOCKOUT_WINDOW_MS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_USER_COOKIE,
} from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db, isTransientDbError, withDbRetry } from "@/lib/db";
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
  | { ok: true; token: string; user: SessionUser; expires: Date }
  | { ok: false; code: "invalid" | "locked" };

const rememberedSessions = new Map<string, { user: SessionUser; until: number }>();

let dummyHash: Promise<string> | null = null;

export const getSession = cache(loadSession);

async function loadSession(): Promise<SessionLookup> {
  const token = await readSessionCookie();
  if (!token) return { status: "anonymous" };

  try {
    const snapshot = readUserSnapshot(await readCookie(SESSION_USER_COOKIE));
    if (snapshot) return { status: "ok", user: snapshot };

    const sessionToken = hashSessionToken(token);
    const remembered = rememberedSessions.get(sessionToken);
    if (remembered && remembered.until > Date.now()) {
      return { status: "ok", user: remembered.user };
    }

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
      rememberedSessions.delete(sessionToken);
      await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
      return { status: "invalid" };
    }

    const renewed = maybeRenewExpires(row.expires);
    if (renewed) {
      after(() => {
        db.session
          .update({ where: { id: row.id }, data: { expires: renewed } })
          .catch(() => undefined);
      });
      rememberSession(sessionToken, row.user, renewed.getTime());
    } else {
      rememberSession(sessionToken, row.user, row.expires.getTime());
    }
    return { status: "ok", user: row.user };
  } catch (error) {
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown";
    logger.info("auth.session_lookup_failed", {
      code,
      transient: isTransientDbError(error),
    });
    // Un blip DB ne doit pas déconnecter : on laisse remonter après retries.
    if (isTransientDbError(error)) throw error;
    return { status: "invalid" };
  }
}

function maybeRenewExpires(current: Date) {
  const remaining = current.getTime() - Date.now();
  if (remaining > SESSION_MAX_AGE_SECONDS * 500) return null;
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

/** Prolonge cookie + ligne Session (appelée depuis le client à l’ouverture de l’app). */
export async function touchCurrentSession(): Promise<
  | { ok: true; token: string; user: SessionUser; expires: Date }
  | { ok: false }
> {
  const token = await readSessionCookie();
  if (!token) return { ok: false };

  const sessionToken = hashSessionToken(token);
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  try {
    const updated = await withDbRetry(() =>
      db.session.updateMany({
        where: { sessionToken, expires: { gt: new Date() } },
        data: { expires },
      }),
    );
    if (updated.count === 0) return { ok: false };

    const row = await withDbRetry(() =>
      db.session.findUnique({
        where: { sessionToken },
        select: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    );
    if (!row) return { ok: false };

    rememberSession(sessionToken, row.user, expires.getTime());
    return { ok: true, token, user: row.user, expires };
  } catch {
    return { ok: false };
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
        select: { id: true, name: true, email: true, role: true, passwordHash: true },
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
    rememberSession(hashSessionToken(token), user, expires.getTime());

    return {
      ok: true,
      token,
      expires,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
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
    rememberedSessions.delete(sessionToken);
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

export function attachUserCookie(response: NextResponse, user: SessionUser, expires: Date) {
  response.cookies.set({
    name: SESSION_USER_COOKIE,
    value: signUserSnapshot(user, expires.getTime()),
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
  response.cookies.set({
    name: SESSION_USER_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function isSameOrigin(request: Request) {
  const host = normalizeHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return normalizeHost(new URL(origin).host) === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return normalizeHost(new URL(referer).host) === host;
    } catch {
      return false;
    }
  }

  // Safari iOS omet parfois Origin/Referer sur un fetch same-origin.
  const site = request.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "same-site";
}

function normalizeHost(value: string | null | undefined) {
  if (!value) return "";
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "";
  try {
    return new URL(`https://${first}`).host.toLowerCase();
  } catch {
    return first;
  }
}

export function appUrl(request: Request, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return new URL(path, `${proto}://${host}`);
}

async function readSessionCookie() {
  return readCookie(SESSION_COOKIE);
}

async function readCookie(name: string) {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return store.get(name)?.value;
}

function rememberSession(sessionToken: string, user: SessionUser, until: number) {
  if (rememberedSessions.size > 40) rememberedSessions.clear();
  rememberedSessions.set(sessionToken, { user, until });
}

function signUserSnapshot(user: SessionUser, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readUserSnapshot(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!signaturesMatch(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      id?: unknown;
      name?: unknown;
      email?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      (parsed.role !== "NURSE" && parsed.role !== "ADMIN") ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return { id: parsed.id, name: parsed.name, email: parsed.email, role: parsed.role };
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function signaturesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET manquant");
  return secret;
}

function hashSessionToken(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest("hex");
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
