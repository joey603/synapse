import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { getSession, isSameOrigin } from "@/lib/auth/session";
import { templateKeyFor } from "@/lib/clinical/templates";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseJerusalemInput } from "@/lib/visits/time";

export const runtime = "nodejs";

type Body = {
  patientId?: string;
  type?: "home" | "phone";
  date?: string;
  time?: string | null;
  done?: boolean;
  docWritten?: boolean;
  note?: string;
  visitId?: string | null;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  }
  const session = await getSession();
  if (session.status === "invalid") return NextResponse.json({ error: "session" }, { status: 401 });
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const patientId = body.patientId?.trim();
  const kind = body.type === "phone" ? "phone" : body.type === "home" ? "home" : null;
  const date = body.date?.trim();
  if (!patientId || !kind || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const time = typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time) ? body.time : "12:00";
  const occurredAt = parseJerusalemInput(`${date}T${time}`);
  if (!occurredAt) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const visitType = kind === "home" ? "IN_PERSON" : "PHONE";
  const done = Boolean(body.done);
  const docWritten = Boolean(body.docWritten);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) || null : null;
  const reportStatus = done && docWritten ? "VALIDATED" : "DRAFT";

  try {
    const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (body.visitId) {
      const existing = await db.visit.findUnique({
        where: { id: body.visitId },
        select: { id: true, patientId: true, report: { select: { id: true, status: true } } },
      });
      if (!existing || existing.patientId !== patientId) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (existing.report?.status === "VALIDATED" && reportStatus !== "VALIDATED") {
        // Autoriser le retour en DRAFT seulement si on bascule la transmission.
      }

      await db.visit.update({
        where: { id: existing.id },
        data: { type: visitType, occurredAt, notes: note },
      });
      if (existing.report) {
        await db.clinicalReport.update({
          where: { id: existing.report.id },
          data: {
            status: reportStatus,
            ...(reportStatus === "VALIDATED"
              ? { validatedAt: new Date(), validatedById: session.user.id }
              : { validatedAt: null, validatedById: null }),
          },
        });
      } else {
        await db.clinicalReport.create({
          data: {
            visitId: existing.id,
            status: reportStatus,
            templateKey: templateKeyFor(visitType),
            ...(reportStatus === "VALIDATED"
              ? { validatedAt: new Date(), validatedById: session.user.id }
              : {}),
          },
        });
      }
      await audit({
        actorId: session.user.id,
        action: "VISIT_UPDATED",
        entityType: "Visit",
        entityId: existing.id,
        patientId,
        visitId: existing.id,
      });
      return NextResponse.json({ ok: true, visitId: existing.id });
    }

    const visit = await db.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: {
          patientId,
          type: visitType,
          occurredAt,
          notes: note,
        },
        select: { id: true },
      });
      await tx.clinicalReport.create({
        data: {
          visitId: created.id,
          status: reportStatus,
          templateKey: templateKeyFor(visitType),
          ...(reportStatus === "VALIDATED"
            ? { validatedAt: new Date(), validatedById: session.user.id }
            : {}),
        },
      });
      return created;
    });

    await audit({
      actorId: session.user.id,
      action: "VISIT_CREATED",
      entityType: "Visit",
      entityId: visit.id,
      patientId,
      visitId: visit.id,
    });

    return NextResponse.json({ ok: true, visitId: visit.id });
  } catch {
    logger.error("tournee.visit_save_failed");
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  }
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: { visitId?: string };
  try {
    body = (await request.json()) as { visitId?: string };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const visitId = body.visitId?.trim();
  if (!visitId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      pipelineStatus: true,
      report: { select: { status: true } },
    },
  });
  if (!visit) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (visit.report?.status === "VALIDATED") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }
  if (["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus)) {
    return NextResponse.json({ error: "busy" }, { status: 409 });
  }

  try {
    await audit({
      actorId: session.user.id,
      action: "VISIT_DELETED",
      entityType: "Visit",
      entityId: visit.id,
      patientId: visit.patientId,
      visitId: visit.id,
    });
    await db.clinicalExtraction.deleteMany({ where: { visitId: visit.id } });
    await db.transcript.deleteMany({ where: { visitId: visit.id } });
    await db.audioRecording.deleteMany({ where: { visitId: visit.id } });
    await db.clinicalReport.deleteMany({ where: { visitId: visit.id } });
    await db.task.updateMany({ where: { visitId: visit.id }, data: { visitId: null } });
    await db.clinicalEvent.updateMany({ where: { visitId: visit.id }, data: { visitId: null } });
    await db.auditLog.updateMany({ where: { visitId: visit.id }, data: { visitId: null } });
    await db.visit.delete({ where: { id: visit.id } });
    return NextResponse.json({ ok: true });
  } catch {
    logger.error("tournee.visit_delete_failed");
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  }
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: { visitId?: string; docWritten?: boolean };
  try {
    body = (await request.json()) as { visitId?: string; docWritten?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const visitId = body.visitId?.trim();
  if (!visitId || typeof body.docWritten !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { id: true, patientId: true, type: true, report: { select: { id: true, status: true } } },
  });
  if (!visit) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const nextStatus = body.docWritten ? "VALIDATED" : "DRAFT";
  try {
    if (visit.report) {
      await db.clinicalReport.update({
        where: { id: visit.report.id },
        data: {
          status: nextStatus,
          ...(nextStatus === "VALIDATED"
            ? { validatedAt: new Date(), validatedById: session.user.id }
            : { validatedAt: null, validatedById: null }),
        },
      });
    } else {
      await db.clinicalReport.create({
        data: {
          visitId: visit.id,
          status: nextStatus,
          templateKey: templateKeyFor(visit.type),
          ...(nextStatus === "VALIDATED"
            ? { validatedAt: new Date(), validatedById: session.user.id }
            : {}),
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    logger.error("tournee.doc_toggle_failed");
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}
