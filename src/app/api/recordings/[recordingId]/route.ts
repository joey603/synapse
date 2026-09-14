import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ recordingId: string }> }) {
  return removeRecording(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ recordingId: string }> }) {
  return removeRecording(request, context);
}

async function removeRecording(
  request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await context.params;
  const recording = await db.audioRecording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      visit: { select: { id: true, patientId: true, pipelineStatus: true } },
    },
  });
  const back = recording
    ? `/patients/${recording.visit.patientId}/visits/${recording.visit.id}`
    : "/patients";

  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, `${back}?audio=save#audio`), 303);
  }

  const session = await getSession();
  if (session.status === "invalid") {
    return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  }
  if (session.status !== "ok") {
    return NextResponse.redirect(appUrl(request, "/login"), 303);
  }
  if (!recording || recording.status !== "STORED") {
    return NextResponse.redirect(appUrl(request, back), 303);
  }

  try {
    await getStorage().delete(recording.storageKey);
    await db.$transaction(async (tx) => {
      await tx.audioRecording.update({
        where: { id: recording.id },
        data: { status: "DELETED", deletedAt: new Date() },
      });
      if (recording.visit.pipelineStatus === "UPLOADED") {
        await tx.visit.update({
          where: { id: recording.visit.id },
          data: { pipelineStatus: "IDLE" },
        });
      }
    });

    await audit({
      actorId: session.user.id,
      action: "AUDIO_DELETED",
      entityType: "AudioRecording",
      entityId: recording.id,
      patientId: recording.visit.patientId,
      visitId: recording.visit.id,
      metadata: { bytes: recording.sizeBytes, mime: recording.mimeType },
    });

    return NextResponse.redirect(appUrl(request, `${back}#audio`), 303);
  } catch {
    logger.error("audio.delete_failed");
    return NextResponse.redirect(appUrl(request, `${back}?audio=save#audio`), 303);
  }
}
