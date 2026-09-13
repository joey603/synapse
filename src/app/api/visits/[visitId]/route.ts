import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { templateKeyFor } from "@/lib/clinical/templates";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
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
