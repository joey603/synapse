import { NextResponse } from "next/server";

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
      recording: { select: { id: true, storageKey: true, status: true } },
      report: { select: { id: true, status: true } },
    },
  });
  const back = visit ? `/patients/${visit.patientId}` : "/patients";

  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, `${back}?error=save`), 303);
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
  if (visit.report?.status === "VALIDATED") {
    return NextResponse.redirect(appUrl(request, `/patients/${visit.patientId}/visits/${visit.id}?error=locked`), 303);
  }
  if (["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus)) {
    return NextResponse.redirect(appUrl(request, `/patients/${visit.patientId}/visits/${visit.id}?error=busy`), 303);
  }

  try {
    if (visit.recording?.status === "STORED") {
      await getStorage().delete(visit.recording.storageKey).catch(() => undefined);
    }

    // Séquentiel (évite les transactions interactives fragiles sur le pooler).
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

    return NextResponse.redirect(appUrl(request, back), 303);
  } catch (error) {
    logger.error("visit.delete_failed", {
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return NextResponse.redirect(
      appUrl(request, `/patients/${visit.patientId}/visits/${visit.id}?error=save`),
      303,
    );
  }
}
