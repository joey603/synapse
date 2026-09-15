import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { parsePatientForm } from "@/lib/patients/parse";
import { deletePatientPhoto, resolvePatientPhoto } from "@/lib/patients/photo";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ patientId: string }> }) {
  return updatePatient(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ patientId: string }> }) {
  return updatePatient(request, context);
}

async function updatePatient(
  request: Request,
  context: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await context.params;
  const back = `/patients/${patientId}/edit`;

  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, `${back}?error=invalid`), 303);
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
    return NextResponse.redirect(appUrl(request, `${back}?error=invalid`), 303);
  }

  try {
    const existing = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, address: true, city: true, photoKey: true },
    });
    if (!existing) {
      return NextResponse.redirect(appUrl(request, "/patients"), 303);
    }

    const photo = await resolvePatientPhoto(form, existing.photoKey);
    if (photo.kind === "error") {
      return NextResponse.redirect(appUrl(request, `${back}?error=${photo.code}`), 303);
    }

    const placeChanged = existing.address !== input.address || existing.city !== input.city;
    const photoData =
      photo.kind === "set"
        ? { photoKey: photo.key, photoMime: photo.mime }
        : photo.kind === "clear"
          ? { photoKey: null, photoMime: null }
          : {};

    if (photo.kind === "clear" && existing.photoKey) {
      await deletePatientPhoto(existing.photoKey);
    }

    await db.patient.update({
      where: { id: patientId },
      data: placeChanged
        ? { ...input, ...photoData, latitude: null, longitude: null, geoKey: null }
        : { ...input, ...photoData },
    });
    await audit({
      actorId: session.user.id,
      action: "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: patientId,
      patientId,
    });
    return NextResponse.redirect(appUrl(request, `/patients/${patientId}`), 303);
  } catch {
    logger.error("patient.update_failed");
    return NextResponse.redirect(appUrl(request, `${back}?error=save`), 303);
  }
}
