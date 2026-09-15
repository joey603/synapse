import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { parsePatientForm } from "@/lib/patients/parse";
import { deletePatientPhoto, resolvePatientPhoto } from "@/lib/patients/photo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, "/patients/new?error=invalid"), 303);
  }

  const session = await getSession();
  if (session.status === "invalid") {
    return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  }
  if (session.status !== "ok") {
    return NextResponse.redirect(appUrl(request, "/login"), 303);
  }

  const form = await request.formData();
  const input = parsePatientForm(form);
  if (!input) {
    return NextResponse.redirect(appUrl(request, "/patients/new?error=invalid"), 303);
  }

  const photo = await resolvePatientPhoto(form, null);
  if (photo.kind === "error") {
    return NextResponse.redirect(appUrl(request, `/patients/new?error=${photo.code}`), 303);
  }

  try {
    const patient = await db.patient.create({
      data: {
        ...input,
        photoKey: photo.kind === "set" ? photo.key : null,
        photoMime: photo.kind === "set" ? photo.mime : null,
      },
      select: { id: true },
    });
    await audit({
      actorId: session.user.id,
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: patient.id,
      patientId: patient.id,
    });
    return NextResponse.redirect(appUrl(request, `/patients/${patient.id}`), 303);
  } catch {
    if (photo.kind === "set") await deletePatientPhoto(photo.key);
    logger.error("patient.create_failed");
    return NextResponse.redirect(appUrl(request, "/patients/new?error=save"), 303);
  }
}
