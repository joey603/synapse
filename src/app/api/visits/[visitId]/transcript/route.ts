import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return removeImportedTranscript(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return removeImportedTranscript(request, context);
}

async function removeImportedTranscript(
  request: Request,
  context: { params: Promise<{ visitId: string }> },
) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      pipelineStatus: true,
      transcript: { select: { id: true, provider: true } },
      recording: { select: { status: true } },
      report: { select: { id: true, status: true } },
    },
  });
  const back = visit ? `/patients/${visit.patientId}/visits/${visit.id}` : "/patients";

  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, `${back}?txt=save&tab=transcript`), 303);
  }

  const session = await getSession();
  if (session.status === "invalid") {
    return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  }
  if (session.status !== "ok") {
    return NextResponse.redirect(appUrl(request, "/login"), 303);
  }
  if (!visit?.transcript) {
    return NextResponse.redirect(appUrl(request, back), 303);
  }
  if (visit.report?.status === "VALIDATED") {
    return NextResponse.redirect(appUrl(request, `${back}?tab=report`), 303);
  }
  if (["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus)) {
    return NextResponse.redirect(appUrl(request, `${back}?txt=busy&tab=transcript`), 303);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.transcript.delete({ where: { id: visit.transcript!.id } });
      await tx.clinicalExtraction.deleteMany({ where: { visitId: visit.id } });
      if (visit.report) {
        await tx.clinicalReport.update({
          where: { id: visit.report.id },
          data: {
            status: "DRAFT",
            aiDraft: null,
            editedDraft: null,
            finalText: null,
            patientStatusNote: null,
            drivingRisk: "NOT_ASSESSED",
            diagnosisNote: null,
            mainProblems: null,
            currentMedication: null,
            interventionsProvided: null,
            carePlan: null,
            validatedAt: null,
            validatedById: null,
            provider: null,
            model: null,
            promptVersion: null,
          },
        });
      }
      const nextStatus = visit.recording?.status === "STORED" ? "UPLOADED" : "IDLE";
      await tx.visit.update({
        where: { id: visit.id },
        data: { pipelineStatus: nextStatus, failureCode: null },
      });
    });

    await audit({
      actorId: session.user.id,
      action: "TRANSCRIPT_DELETED",
      entityType: "Transcript",
      entityId: visit.transcript.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { provider: visit.transcript.provider, resetPipeline: true },
    });

    return NextResponse.redirect(appUrl(request, `${back}?tab=transcript#import`), 303);
  } catch {
    logger.error("transcript.delete_failed");
    return NextResponse.redirect(appUrl(request, `${back}?txt=save&tab=transcript`), 303);
  }
}

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
