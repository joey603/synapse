import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    include: { report: true },
  });
  const back = visit ? `/patients/${visit.patientId}/visits/${visit.id}?tab=report` : "/patients";
  if (!isSameOrigin(request)) return NextResponse.redirect(appUrl(request, back), 303);

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.redirect(appUrl(request, "/login"), 303);
  if (!visit?.report) return NextResponse.redirect(appUrl(request, back), 303);

  const text = visit.report.editedDraft?.trim() ?? "";
  if (!text || (visit.report.status !== "AI_GENERATED" && visit.report.status !== "REVIEWED")) {
    return NextResponse.redirect(appUrl(request, back), 303);
  }

  await db.clinicalReport.update({
    where: { id: visit.report.id },
    data: {
      status: "VALIDATED",
      finalText: visit.report.editedDraft,
      validatedAt: new Date(),
      validatedById: session.user.id,
    },
  });
  await audit({
    actorId: session.user.id,
    action: "REPORT_VALIDATED",
    entityType: "ClinicalReport",
    entityId: visit.report.id,
    patientId: visit.patientId,
    visitId: visit.id,
    metadata: { from: visit.report.status, to: "VALIDATED" },
  });

  return NextResponse.redirect(appUrl(request, back), 303);
}
