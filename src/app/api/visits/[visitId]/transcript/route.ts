import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const transcript = await db.transcript.findUnique({
    where: { visitId },
    select: {
      id: true,
      rawText: true,
      providerText: true,
      visit: { select: { patientId: true, report: { select: { status: true } } } },
    },
  });
  if (!transcript || transcript.visit.report?.status === "VALIDATED") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 50000) : "";
  if (!text) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const changed = text !== transcript.rawText;
  await db.transcript.update({
    where: { id: transcript.id },
    data: {
      rawText: text,
      editedAt: changed || text !== (transcript.providerText ?? transcript.rawText) ? new Date() : undefined,
    },
  });

  if (changed) {
    await audit({
      actorId: session.user.id,
      action: "TRANSCRIPT_EDITED",
      entityType: "Transcript",
      entityId: transcript.id,
      patientId: transcript.visit.patientId,
      visitId,
    });
  }

  return NextResponse.json({ saved: true });
}
