import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const { visitId } = await context.params;
  const report = await db.clinicalReport.findUnique({
    where: { visitId },
    select: { id: true, visit: { select: { patientId: true } } },
  });
  if (!report) return NextResponse.json({ error: "missing" }, { status: 404 });

  await audit({
    actorId: session.user.id,
    action: "REPORT_COPIED",
    entityType: "ClinicalReport",
    entityId: report.id,
    patientId: report.visit.patientId,
    visitId,
  });
  return NextResponse.json({ ok: true });
}
