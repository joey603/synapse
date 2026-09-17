import { scrubForbidden } from "@/lib/clinical/forbidden-phrases";
import { EXTRACTION_RULES, PROMPT_VERSION as EXTRACTION_PROMPT } from "../../../prompts/clinical-extraction";
import {
  CLINICAL_REPORT_SYSTEM,
  CLINICAL_REPORT_USER_PREAMBLE,
  CLINICAL_REPORT_PROMPT_VERSION,
} from "../../../prompts/clinical-report";
import type { ClinicalLanguageProvider, TranscriptionProvider, WriteReportInput } from "@/lib/ai/types";
import type { StoredExtraction } from "@/lib/clinical/types";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

const transcribeModel = () => process.env.AI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const clinicalModel = () => process.env.AI_CLINICAL_MODEL || "gpt-4.1-mini";

export const openaiTranscription: TranscriptionProvider = {
  async transcribe({ audio, mimeType, filename }) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("provider_unavailable");

    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename || "audio.m4a");
    form.set("model", transcribeModel());
    form.set("prompt", "Transcribe the spoken words. Do not translate. Do not fill gaps.");

    const response = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!response.ok) throw new Error("transcription_failed");
    const data = (await response.json()) as { text?: string; language?: string };
    if (!data.text?.trim()) throw new Error("transcription_failed");
    return { text: data.text, detectedLanguage: data.language ?? null, model: transcribeModel() };
  },
};

export const openaiClinical: ClinicalLanguageProvider = {
  async extract(input) {
    const { FACT_DOMAINS } = await import("@/lib/clinical/types");
    const data = await chat({
      system: EXTRACTION_RULES,
      user: [
        "CONTEXTE. L’historique et le dossier sont en lecture seule. Ils ne remplissent pas la visite actuelle.",
        "INTERDIT : inventer une medicationDiscrepancy ou un médicament à partir de l’historique si le nom n’apparaît pas dans la transcription / Nurse Note actuelles.",
        input.context,
        "TRANSCRIPTION DE LA VISITE ACTUELLE. Seule source, avec les notes infirmières ci-dessus, pour affirmer le constat d’aujourd’hui.",
        input.transcript,
        `DOMAINES facts obligatoires (tous présents dans facts, not_assessed si non abordé) : ${FACT_DOMAINS.join(", ")}.`,
        "Remplis facts[] EN PRIORITÉ pour tout domaine abordé aujourd’hui (humeur, sommeil, anxiété/OCD, insight, fonctionnement, suicidalité, etc.) avec assertion present/explicitly_denied + value hébreu + evidence[]. Ne laisse pas not_assessed un domaine documenté.",
        "Remplis interventions[] et plan[] avec evidence[] pour tout ce qui est documenté aujourd’hui (soutien, psychoéducation, TCC, suivi sommeil/suicidality, etc.).",
        "Ne crée une contradiction que pour des assertions réellement incompatibles (même objet, temporalité compatible). Évolution relationnelle ≠ contradiction.",
        "Si suicidality=explicitly_denied, n’ajoute aucun pointToVerify affirmant l’absence de négation explicite.",
        "finalReportHe : laisse null — la transmission complète est générée séparément (clinical-report).",
      ].join("\n\n"),
      json: true,
      maxTokens: 8000,
    });
    return JSON.parse(data);
  },
  async writeReport(input) {
    const data = await chat({
      system: CLINICAL_REPORT_SYSTEM,
      user: buildReportUserMessage(input),
      maxTokens: 12000,
    });
    return { text: data, model: clinicalModel() };
  },
  async generateReport(input) {
    const written = await openaiClinical.writeReport(input);
    return { text: scrubForbidden(written.text, input.extraction).text, model: written.model };
  },
  async rewrite({ text, action, extraction }) {
    const data = await chat({
      system: `${CLINICAL_REPORT_SYSTEM}\n\nAction demandée: ${action}. Ne pas ajouter de fait clinique absent de la transmission fournie / du JSON validé.`,
      user: text,
      maxTokens: action === "shorten" ? 4000 : 12000,
    });
    return { text: scrubForbidden(data, extraction).text, model: clinicalModel() };
  },
};

function buildReportUserMessage(input: WriteReportInput) {
  const parts = [
    CLINICAL_REPORT_USER_PREAMBLE,
    `PROMPT_VERSION=${CLINICAL_REPORT_PROMPT_VERSION}`,
    input.context?.trim()
      ? input.context.trim()
      : "PATIENT / AUTHORITATIVE TREATMENT / VALIDATED HISTORY : non fournis pour cet appel.",
    "VALIDATED CLINICAL JSON (guide structuré — ne limite pas la richesse si la transcription contient davantage) :",
    JSON.stringify(publicAnalysis(input.extraction)),
    "CURRENT VISIT — TRANSCRIPTION (source principale de richesse clinique) :",
    input.transcript?.trim() || "(transcription absente)",
  ];
  if (input.nurseNotes?.trim()) {
    parts.push("CURRENT VISIT — NURSE NOTE :", input.nurseNotes.trim());
  }
  if (input.visitType || input.occurredAt) {
    parts.push(
      "MÉTADONNÉES VISITE :",
      [
        input.visitType ? `Type: ${input.visitType}` : null,
        input.occurredAt ? `Date: ${input.occurredAt.toISOString().slice(0, 10)}` : null,
        input.patientName ? `Patient: ${input.patientName}` : null,
      ]
        .filter(Boolean)
        .join(". "),
    );
  }
  return parts.join("\n\n");
}

async function chat(input: {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("provider_unavailable");
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: clinicalModel(),
      temperature: 0.2,
      max_completion_tokens: input.maxTokens ?? (input.json ? 8000 : 12000),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!response.ok) throw new Error("provider_failed");
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("provider_failed");
  return text;
}

function publicAnalysis(extraction: StoredExtraction) {
  return {
    facts: extraction.facts,
    longitudinal: extraction.longitudinal,
    interventions: extraction.interventions,
    plan: extraction.plan,
    contradictions: extraction.contradictions,
    medicationDiscrepancies: extraction.medicationDiscrepancies,
    pointsToVerify: extraction.pointsToVerify,
    suggestedTasks: extraction.suggestedTasks,
  };
}

export const openaiPromptVersion = EXTRACTION_PROMPT;
export { clinicalModel, OPENAI_CHAT_URL, OPENAI_TRANSCRIBE_URL };
