import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { parseTourneeList } from "@/lib/patients/parse-tournee-list";
import { syncTourneeRoster } from "@/lib/patients/sync-roster";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  }

  const session = await getSession();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length < 20) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  if (text.length > 120_000) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const parsed = parseTourneeList(text);
  if (!parsed.patients.length) {
    return NextResponse.json(
      { error: "parse", details: parsed.errors.slice(0, 8) },
      { status: 400 },
    );
  }

  try {
    const result = await syncTourneeRoster(session.user.id, parsed.patients);
    return NextResponse.json({
      ok: true,
      ...result,
      parseErrors: parsed.errors.slice(0, 12),
    });
  } catch (error) {
    logger.error("patients.sync_roster_failed", { error: String(error) });
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}
