import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 200_000;
const MAX_CHARS = 50_000;

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      pipelineStatus: true,
      transcript: { select: { id: true } },
      report: { select: { status: true } },
    },
  });
  const back = visit
    ? `/patients/${visit.patientId}/visits/${visit.id}?tab=transcript`
    : "/patients";

  if (!isSameOrigin(request)) {
    return redirect(request, back, "origin");
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
    return redirect(request, back, "locked");
  }
  if (visit.transcript) {
    return redirect(request, back, "exists");
  }
  if (["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus)) {
    return redirect(request, back, "busy");
  }

  const form = await request.formData();
  const upload = asUpload(form.get("file"));
  if (!upload) {
    return redirect(request, back, "type");
  }
  if (!isTextUpload(upload.name, upload.type)) {
    return redirect(request, back, "type");
  }
  if (upload.size <= 0 || upload.size > MAX_BYTES) {
    return redirect(request, back, "size");
  }

  let text: string;
  try {
    text = (await upload.text()).replace(/^\uFEFF/, "").trim();
  } catch {
    return redirect(request, back, "save");
  }
  if (!text) {
    return redirect(request, back, "empty");
  }
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }

  await db.transcript.create({
    data: {
      visitId: visit.id,
      rawText: text,
      providerText: text,
      detectedLanguage: null,
      provider: "import",
      model: "text-file",
      promptVersion: "import-1",
    },
  });

  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "TRANSCRIBED", failureCode: null },
  });

  await audit({
    actorId: session.user.id,
    action: "TRANSCRIPT_IMPORTED",
    entityType: "Transcript",
    entityId: visit.id,
    patientId: visit.patientId,
    visitId: visit.id,
    metadata: {
      bytes: upload.size,
      chars: text.length,
      filename: upload.name.slice(0, 120),
    },
  });

  // Comme l’audio : import seulement, puis « Lancer » sur la page visite.
  return NextResponse.redirect(
    appUrl(request, `/patients/${visit.patientId}/visits/${visit.id}?tab=transcript`),
    303,
  );
}

function asUpload(value: FormDataEntryValue | null): {
  name: string;
  size: number;
  type: string;
  text: () => Promise<string>;
} | null {
  if (!value || typeof value === "string") return null;
  const blob = value as Blob & { name?: string };
  if (typeof blob.arrayBuffer !== "function" || typeof blob.text !== "function") return null;
  if (typeof blob.size !== "number") return null;
  return {
    name: typeof blob.name === "string" ? blob.name : "",
    size: blob.size,
    type: typeof blob.type === "string" ? blob.type : "",
    text: () => blob.text(),
  };
}

function isTextUpload(filename: string, mime: string) {
  const name = filename.toLowerCase();
  const type = mime.toLowerCase();
  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".text") ||
    name.endsWith(".markdown")
  ) {
    return true;
  }
  if (type.startsWith("text/")) return true;
  return false;
}

function redirect(request: Request, back: string, code: string) {
  const url = new URL(back, appUrl(request, "/").origin);
  url.searchParams.set("txt", code);
  return NextResponse.redirect(url, 303);
}
