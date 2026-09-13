import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { inspectAudioFile, safeFilename } from "@/lib/audio/inspect";
import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      pipelineStatus: true,
      recording: { select: { id: true, status: true } },
    },
  });
  const back = visit ? `/patients/${visit.patientId}/visits/${visit.id}` : "/patients";

  if (!isSameOrigin(request)) {
    return redirect(request, back, "save");
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

  if (visit.recording?.status === "STORED") {
    return redirect(request, back, "exists");
  }

  const form = await request.formData();
  if (form.get("consent") !== "on") {
    return redirect(request, back, "consent");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return redirect(request, back, "type");
  }

  const checked = inspectAudioFile(file);
  if (!checked.ok) {
    return redirect(request, back, checked.code === "size" ? "size" : "type");
  }

  const key = `audio/${randomUUID()}`;
  let stored = false;

  try {
    const body = Buffer.from(await file.arrayBuffer());
    if (body.byteLength !== file.size) {
      return redirect(request, back, "save");
    }

    await getStorage().put(key, body, checked.mimeType);
    stored = true;

    const recording = visit.recording
      ? await db.audioRecording.update({
          where: { id: visit.recording.id },
          data: {
            storageKey: key,
            originalFilename: safeFilename(file.name),
            mimeType: checked.mimeType,
            sizeBytes: body.byteLength,
            status: "STORED",
            retentionPolicy: "KEEP",
            consentAcknowledged: true,
            deletedAt: null,
          },
          select: { id: true },
        })
      : await db.audioRecording.create({
          data: {
            visitId: visit.id,
            storageKey: key,
            originalFilename: safeFilename(file.name),
            mimeType: checked.mimeType,
            sizeBytes: body.byteLength,
            status: "STORED",
            retentionPolicy: "KEEP",
            consentAcknowledged: true,
          },
          select: { id: true },
        });

    if (visit.pipelineStatus === "IDLE" || visit.pipelineStatus === "FAILED") {
      await db.visit.update({
        where: { id: visit.id },
        data: { pipelineStatus: "UPLOADED", failureCode: null },
      });
    }

    await audit({
      actorId: session.user.id,
      action: "AUDIO_UPLOADED",
      entityType: "AudioRecording",
      entityId: recording.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { bytes: body.byteLength, mime: checked.mimeType },
    });

    return NextResponse.redirect(appUrl(request, `${back}#audio`), 303);
  } catch {
    if (stored) {
      await getStorage().delete(key).catch(() => undefined);
    }
    logger.error("audio.upload_failed");
    return redirect(request, back, "save");
  }
}

function redirect(request: Request, back: string, code: string) {
  return NextResponse.redirect(appUrl(request, `${back}?audio=${code}#audio`), 303);
}
