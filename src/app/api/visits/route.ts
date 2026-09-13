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

export async function POST(request: Request) {
  const form = await request.formData();
  const patientId = String(form.get("patientId") ?? "");
  const agenda = agendaReturnPath(form.get("returnTo"));
  const back = agenda ?? (patientId ? `/patients/${patientId}/visits/new` : "/patients");

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

  const input = parseVisitForm(form);
  if (!input || !patientId) {
    return NextResponse.redirect(appUrl(request, withQuery(back, "error", "invalid")), 303);
  }

  try {
    const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) {
      return NextResponse.redirect(appUrl(request, "/patients"), 303);
    }

    const visit = await db.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: {
          patientId,
          type: input.type,
          occurredAt: input.occurredAt,
          notes: input.notes,
        },
        select: { id: true },
      });
      await tx.clinicalReport.create({
        data: {
          visitId: created.id,
          status: "DRAFT",
          templateKey: templateKeyFor(input.type),
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

    const createdDay = jerusalemDateKey(input.occurredAt);
    const done = agenda
      ? `/agenda?month=${createdDay.slice(0, 7)}&day=${createdDay}`
      : `/patients/${patientId}/visits/${visit.id}`;
    return NextResponse.redirect(appUrl(request, done), 303);
  } catch {
    logger.error("visit.create_failed");
    return NextResponse.redirect(appUrl(request, withQuery(back, "error", "save")), 303);
  }
}
