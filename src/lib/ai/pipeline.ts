import "server-only";

import { Readable } from "node:stream";

import { loadVisitContext } from "@/lib/ai/context";
import { getClinicalProvider, getTranscriptionProvider, providerName } from "@/lib/ai/factory";
import { audit } from "@/lib/audit";
import { diffValidated } from "@/lib/clinical/diff";
import { buildDeterministicHebrewReport } from "@/lib/clinical/compose-report";
import { scrubForbidden } from "@/lib/clinical/forbidden-phrases";
import { reviewFlags } from "@/lib/clinical/review-flags";
import { composeStructuredSections } from "@/lib/clinical/structured-report";
import { validateExtraction } from "@/lib/clinical/validators";
import { parseStored } from "@/lib/clinical/schema";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";
import { PROMPT_VERSION as EXTRACTION_PROMPT } from "../../../prompts/clinical-extraction";
import { CLINICAL_REPORT_PROMPT_VERSION as REPORT_PROMPT } from "../../../prompts/clinical-report";

const running = new Set<string>();

export async function startPipeline(
  visitId: string,
  actorId: string,
  mode: "transcribe" | "analyze" = "transcribe",
) {
  if (running.has(visitId)) return;
  running.add(visitId);
  try {
    await runPipeline(visitId, actorId, mode);
  } finally {
    running.delete(visitId);
  }
}

async function runPipeline(visitId: string, actorId: string, mode: "transcribe" | "analyze") {
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    include: { recording: true, transcript: true, extraction: true, report: true, patient: true },
  });
  if (!visit) return;
  if (visit.report?.status === "VALIDATED") return;

  try {
    // mode=transcribe : transcription → analyse → transmission (pipeline complet).
    // mode=analyze : repart de la transcription existante (ré-analyse / régénération).
    let current = visit;
    if (mode === "transcribe" && !current.transcript) {
      await transcribe(current, actorId);
      const reloaded = await reload(visitId);
      if (!reloaded?.transcript) return;
      current = reloaded;
    }

    if (!current.transcript) {
      const ready = await reload(visitId);
      if (!ready?.transcript) return;
      current = ready;
    }

    if (current.extraction) {
      await db.clinicalExtraction.delete({ where: { visitId } });
    }
    if (current.report?.aiDraft) {
      await db.clinicalReport.update({
        where: { visitId },
        data: { aiDraft: null },
      });
    }
    const cleared = await reload(visitId);
    if (!cleared?.transcript) return;
    await extract(cleared, actorId);
    const afterExtract = await reload(visitId);
    if (!afterExtract?.extraction || !afterExtract.report) return;
    if (!afterExtract.report.aiDraft) {
      await generate(afterExtract, actorId);
    }
  } catch (error) {
    const code = stableCode(error);
    await db.visit.update({
      where: { id: visitId },
      data: { pipelineStatus: "FAILED", failureCode: code },
    });
    logger.error("pipeline.failed");
  }
}

async function transcribe(
  visit: NonNullable<Awaited<ReturnType<typeof reload>>>,
  actorId: string,
) {
  if (!visit.recording || visit.recording.status !== "STORED") {
    throw new Error("audio_missing");
  }

  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "TRANSCRIBING", failureCode: null },
  });
  await audit({
    actorId,
    action: "TRANSCRIBE_STARTED",
    entityType: "Visit",
    entityId: visit.id,
    patientId: visit.patientId,
    visitId: visit.id,
  });

  const audio = await readAudio(visit.recording.storageKey);
  let result;
  try {
    result = await getTranscriptionProvider().transcribe({
      audio,
      mimeType: visit.recording.mimeType,
      filename: visit.recording.originalFilename,
    });
  } catch (error) {
    await audit({
      actorId,
      action: "TRANSCRIBE_FAILED",
      entityType: "Visit",
      entityId: visit.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { code: stableCode(error) },
    });
    throw error;
  }

  await db.transcript.create({
    data: {
      visitId: visit.id,
      rawText: result.text,
      providerText: result.text,
      detectedLanguage: result.detectedLanguage,
      provider: providerName(),
      model: result.model,
      promptVersion: "transcribe-1",
    },
  });

  if (visit.recording.retentionPolicy === "DELETE_AFTER_TRANSCRIPTION") {
    await getStorage().delete(visit.recording.storageKey);
    await db.audioRecording.update({
      where: { id: visit.recording.id },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    await audit({
      actorId,
      action: "AUDIO_DELETED",
      entityType: "AudioRecording",
      entityId: visit.recording.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { reason: "after_transcription" },
    });
  }

  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "TRANSCRIBED", failureCode: null },
  });
  await audit({
    actorId,
    action: "TRANSCRIBE_SUCCEEDED",
    entityType: "Visit",
    entityId: visit.id,
    patientId: visit.patientId,
    visitId: visit.id,
    metadata: { model: result.model },
  });
}

async function extract(
  visit: NonNullable<Awaited<ReturnType<typeof reload>>>,
  actorId: string,
) {
  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "EXTRACTING", failureCode: null },
  });

  const context = await loadVisitContext(visit.patientId, visit.id);
  let raw: unknown;
  try {
    raw = await getClinicalProvider().extract({
      transcript: visit.transcript!.rawText,
      context: context.text,
    });
  } catch {
    await audit({
      actorId,
      action: "EXTRACT_FAILED",
      entityType: "Visit",
      entityId: visit.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { code: "extraction_failed" },
    });
    throw new Error("extraction_failed");
  }

  const validated = validateExtraction(raw, visit.transcript!.rawText, visit.notes ?? "");
  if (!validated) {
    await audit({
      actorId,
      action: "EXTRACT_FAILED",
      entityType: "Visit",
      entityId: visit.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { code: "extraction_invalid" },
    });
    throw new Error("extraction_failed");
  }

  const previous = await previousExtraction(visit.patientId, visit.id);
  validated.changes = diffValidated(validated, previous);
  validated.reviewFlags = reviewFlags(validated, context.medicationNames);

  await db.clinicalExtraction.create({
    data: {
      visitId: visit.id,
      schemaVersion: "2",
      promptVersion: EXTRACTION_PROMPT,
      provider: providerName(),
      model: providerName() === "openai" ? process.env.AI_CLINICAL_MODEL || "openai" : "fake-extract",
      payload: validated,
    },
  });
  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "EXTRACTED", failureCode: null },
  });
  await audit({
    actorId,
    action: "EXTRACT_SUCCEEDED",
    entityType: "Visit",
    entityId: visit.id,
    patientId: visit.patientId,
    visitId: visit.id,
    metadata: { prompt: EXTRACTION_PROMPT },
  });
}

async function generate(
  visit: NonNullable<Awaited<ReturnType<typeof reload>>>,
  actorId: string,
) {
  if (!visit.report || visit.report.status === "VALIDATED") return;
  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "GENERATING", failureCode: null },
  });

  const extraction = parseStored(visit.extraction?.payload);
  if (!extraction) throw new Error("generation_failed");

  const meds = await db.medication.findMany({
    where: { patientId: visit.patientId, active: true },
    orderBy: { name: "asc" },
    select: { name: true, dose: true, frequency: true },
  });
  const diagnosis = {
    primary: visit.patient.primaryDiagnosis,
    secondary: visit.patient.secondaryDiagnoses,
  };

  // Projection Zebra AVANT la rédaction narrative — source = JSON validé (pas finalReportHe).
  const structured = composeStructuredSections({
    extraction,
    visitType: visit.type,
    diagnosis,
    medications: meds,
    sex: visit.patient.sex,
  });

  let text: string;
  let model: string;
  try {
    const drafted = await draftHebrew(visit, extraction, meds, diagnosis);
    text = drafted.text;
    model = drafted.model;
  } catch {
    throw new Error("generation_failed");
  }

  if (!text.trim()) throw new Error("generation_failed");

  await db.clinicalReport.update({
    where: { visitId: visit.id },
    data: {
      status: "AI_GENERATED",
      aiDraft: text,
      editedDraft: text,
      finalText: null,
      provider: providerName(),
      model,
      promptVersion: REPORT_PROMPT,
      ...structured,
    },
  });
  await db.clinicalExtraction.update({
    where: { visitId: visit.id },
    data: { payload: { ...extraction, finalReportHe: text } },
  });
  await db.visit.update({
    where: { id: visit.id },
    data: { pipelineStatus: "READY", failureCode: null },
  });
  await audit({
    actorId,
    action: "REPORT_GENERATED",
    entityType: "ClinicalReport",
    entityId: visit.report.id,
    patientId: visit.patientId,
    visitId: visit.id,
    metadata: { prompt: REPORT_PROMPT },
  });
}

async function draftHebrew(
  visit: NonNullable<Awaited<ReturnType<typeof reload>>>,
  extraction: NonNullable<ReturnType<typeof parseStored>>,
  medications: Array<{ name: string; dose: string | null; frequency: string | null }>,
  diagnosis: { primary: string | null; secondary: string | null },
) {
  const fallback = () =>
    scrubForbidden(
      buildDeterministicHebrewReport({
        extraction,
        visitType: visit.type,
        diagnosis,
        medications,
      }),
      extraction,
    ).text;

  if (providerName() === "fake") {
    return { text: fallback(), model: "fake-report" };
  }

  // Transmission clinique complète (clinical-report-v*) depuis transcription + contexte patient.
  // Les champs Zebra restent projetés séparément ; on ne raccourcit plus le récit via projection.
  const context = await loadVisitContext(visit.patientId, visit.id);
  try {
    const written = await getClinicalProvider().writeReport({
      extraction,
      transcript: visit.transcript?.rawText ?? "",
      nurseNotes: visit.notes,
      context: context.text,
      visitType: visit.type,
      occurredAt: visit.occurredAt,
      patientName: `${visit.patient.firstName} ${visit.patient.lastName}`.trim(),
    });
    const scrubbed = scrubForbidden(written.text, extraction);
    if (scrubbed.text.trim()) {
      return { text: scrubbed.text, model: written.model };
    }
  } catch {
    // fallback déterministe ci-dessous
  }

  return { text: fallback(), model: "deterministic-fallback" };
}

async function previousExtraction(patientId: string, visitId: string) {
  const row = await db.clinicalExtraction.findFirst({
    where: { visit: { patientId, id: { not: visitId }, report: { status: "VALIDATED" } } },
    orderBy: { createdAt: "desc" },
  });
  return row ? parseStored(row.payload) : null;
}

async function readAudio(key: string) {
  const stream = await getStorage().getStream(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function reload(id: string) {
  return db.visit.findUnique({
    where: { id },
    include: { recording: true, transcript: true, extraction: true, report: true, patient: true },
  });
}

function stableCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "audio_missing" || message === "provider_unavailable" || message === "transcription_failed") {
    return message;
  }
  if (message === "extraction_failed" || message === "generation_failed") return message;
  return "transcription_failed";
}
