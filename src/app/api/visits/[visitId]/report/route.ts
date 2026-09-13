import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return saveReport(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return saveReport(request, context);
}

async function saveReport(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const session = await getSession();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }

  const report = await db.clinicalReport.findUnique({
    where: { visitId },
    select: { id: true, status: true, aiDraft: true, visit: { select: { patientId: true } } },
  });
  if (!report || report.status === "VALIDATED" || report.status === "DRAFT") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.slice(0, 12000) : null;
  if (text === null) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const status = text !== (report.aiDraft ?? "") ? "REVIEWED" : report.status;
  await db.clinicalReport.update({
    where: { id: report.id },
    data: { editedDraft: text, status },
  });
  if (status === "REVIEWED" && report.status !== "REVIEWED") {
    await audit({
      actorId: session.user.id,
      action: "REPORT_EDITED",
      entityType: "ClinicalReport",
      entityId: report.id,
      patientId: report.visit.patientId,
      visitId,
      metadata: { from: report.status, to: status },
    });
  }

  return NextResponse.json({ status });
}
