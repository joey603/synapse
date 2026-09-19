import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { templateKeyFor } from "@/lib/clinical/templates";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";
import { parseVisitForm } from "@/lib/visits/parse";
import { agendaReturnPath, withQuery } from "@/lib/visits/return";
import { jerusalemDateKey } from "@/lib/visits/time";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return updateVisit(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return updateVisit(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      pipelineStatus: true,
      recording: { select: { id: true, storageKey: true, status: true } },
      report: { select: { id: true, status: true } },
    },
  });
  const back = visit ? `/patients/${visit.patientId}` : "/patients";

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }

  const session = await getSession();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  if (!visit) {
    return NextResponse.json({ error: "missing" }, { status: 404 });
  }
  if (visit.report?.status === "VALIDATED") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }
  if (["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus)) {
    return NextResponse.json({ error: "busy" }, { status: 409 });
  }

  try {
    if (visit.recording?.status === "STORED") {
      await getStorage().delete(visit.recording.storageKey).catch(() => undefined);
    }

    await db.clinicalExtraction.deleteMany({ where: { visitId: visit.id } });
    await db.transcript.deleteMany({ where: { visitId: visit.id } });
    await db.audioRecording.deleteMany({ where: { visitId: visit.id } });
    await db.clinicalReport.deleteMany({ where: { visitId: visit.id } });
    await db.task.updateMany({ where: { visitId: visit.id }, data: { visitId: null } });
    await db.clinicalEvent.updateMany({ where: { visitId: visit.id }, data: { visitId: null } });
    await db.auditLog.updateMany({ where: { visitId: visit.id }, data: { visitId: null } });
    await db.visit.delete({ where: { id: visit.id } });

    await audit({
      actorId: session.user.id,
      action: "VISIT_DELETED",
      entityType: "Visit",
      entityId: visit.id,
      patientId: visit.patientId,
      metadata: { hadRecording: Boolean(visit.recording) },
    });

    return NextResponse.json({ ok: true, redirectTo: back });
  } catch (error) {
    logger.error("visit.delete_failed", {
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}

async function updateVisit(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { id: true, patientId: true, report: { select: { status: true } } },
  });
  const form = await request.formData();
  const agenda = agendaReturnPath(form.get("returnTo"));
  const back = agenda ?? (visit ? `/patients/${visit.patientId}/visits/${visit.id}` : "/patients");

  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, withQuery(back, "error", "invalid")), 303);
  }

  const session = await getSession();
  if (session.status === "invalid") {
    return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  }
  if (session.status !== "ok") {
    return NextResponse.redirect(appUrl(request, "/login"), 303);
  }
  if (!visit) {
    return NextResponse.redirect(appUrl(request, "/patients"), 303);
  }

  const input = parseVisitForm(form);
  const errorBack = agenda ? withQuery(back, "edit", visit.id) : back;
  if (!input) {
    return NextResponse.redirect(appUrl(request, withQuery(errorBack, "error", "invalid")), 303);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.visit.update({
        where: { id: visit.id },
        data: {
          type: input.type,
          occurredAt: input.occurredAt,
          notes: input.notes,
        },
      });
      if (visit.report?.status === "DRAFT") {
        await tx.clinicalReport.update({
          where: { visitId: visit.id },
          data: { templateKey: templateKeyFor(input.type) },
        });
      }
    });

    await audit({
      actorId: session.user.id,
      action: "VISIT_UPDATED",
      entityType: "Visit",
      entityId: visit.id,
      patientId: visit.patientId,
      visitId: visit.id,
    });

    const createdDay = jerusalemDateKey(input.occurredAt);
    const done = agenda ? `/agenda?month=${createdDay.slice(0, 7)}&day=${createdDay}` : back;
    return NextResponse.redirect(appUrl(request, done), 303);
  } catch {
    logger.error("visit.update_failed");
    return NextResponse.redirect(appUrl(request, withQuery(errorBack, "error", "save")), 303);
  }
}
