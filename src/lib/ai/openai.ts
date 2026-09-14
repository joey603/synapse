import { scrubForbidden } from "@/lib/clinical/forbidden-phrases";
import { EXTRACTION_RULES, PROMPT_VERSION as EXTRACTION_PROMPT } from "../../../prompts/clinical-extraction";
import { REPORT_RULES } from "../../../prompts/nursing-report-he";
import type { ClinicalLanguageProvider, TranscriptionProvider } from "@/lib/ai/types";

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

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
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
    const data = await chat({
      system: EXTRACTION_RULES,
      user: [
        "CONTEXTE. L’historique et le dossier sont en lecture seule. Ils ne remplissent pas la visite actuelle.",
        input.context,
        "TRANSCRIPTION DE LA VISITE ACTUELLE. Seule source, avec les notes infirmières ci-dessus, pour affirmer le constat d’aujourd’hui.",
        input.transcript,
      ].join("\n\n"),
      json: true,
    });
    return JSON.parse(data);
  },
  async writeReport(input) {
    const data = await chat({
      system: REPORT_RULES,
      user: JSON.stringify(publicAnalysis(input.extraction)),
    });
    return { text: data, model: clinicalModel() };
  },
  async generateReport(input) {
    const written = await openaiClinical.writeReport(input);
    return { text: scrubForbidden(written.text, input.extraction).text, model: written.model };
  },
  async rewrite({ text, action, extraction }) {
    const data = await chat({
      system: `${REPORT_RULES} Action: ${action}. Ne pas ajouter de fait.`,
      user: text,
    });
    return { text: scrubForbidden(data, extraction).text, model: clinicalModel() };
  },
};

async function chat(input: { system: string; user: string; json?: boolean }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("provider_unavailable");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: clinicalModel(),
      temperature: 0.1,
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

function publicAnalysis(extraction: Parameters<typeof scrubForbidden>[1]) {
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
