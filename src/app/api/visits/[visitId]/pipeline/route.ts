import { NextResponse } from "next/server";

import { startPipeline } from "@/lib/ai/pipeline";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ visitId: string }> }) {
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { pipelineStatus: true, failureCode: true, report: { select: { status: true } } },
  });
  if (!visit) return NextResponse.json({ error: "missing" }, { status: 404 });

  return NextResponse.json({
    pipelineStatus: visit.pipelineStatus,
    failureCode: visit.failureCode,
    reportStatus: visit.report?.status ?? null,
  });
}

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { id: true, patientId: true },
  });
  const back = visit ? `/patients/${visit.patientId}/visits/${visit.id}` : "/patients";

  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, back), 303);
  }
  const session = await getSession();
  if (session.status === "invalid") return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  if (session.status !== "ok") return NextResponse.redirect(appUrl(request, "/login"), 303);
  if (!visit) return NextResponse.redirect(appUrl(request, "/patients"), 303);

  const form = await request.formData().catch(() => null);
  const mode = form?.get("mode") === "analyze" ? "analyze" : "transcribe";
  const report = await db.clinicalReport.findUnique({
    where: { visitId: visit.id },
    select: { status: true },
  });
  if (report?.status === "VALIDATED") {
    return NextResponse.redirect(appUrl(request, back), 303);
  }

  void startPipeline(visit.id, session.user.id, mode).catch(() => logger.error("pipeline.failed"));
  // Pipeline complet (transcribe) et ré-analyse aboutissent à la transmission.
  const tab = mode === "analyze" ? "analysis" : "report";
  return NextResponse.redirect(appUrl(request, `${back}?run=1&tab=${tab}`), 303);
}
