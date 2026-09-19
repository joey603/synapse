/**
 * Configuration centralisée des modèles OpenAI.
 * En production avec AI_PROVIDER=openai, AI_CLINICAL_MODEL est obligatoire
 * (pas de fallback silencieux vers un autre modèle).
 */

const V1_CLINICAL_MODEL_DEV_FALLBACK = "gpt-5.4-mini";
const V1_TRANSCRIBE_MODEL_DEV_FALLBACK = "gpt-4o-mini-transcribe";

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function provider() {
  return (process.env.AI_PROVIDER || "fake").trim().toLowerCase();
}

/** Modèle clinique — ne jamais logger la valeur hors usage technique (pas de payload). */
export function getClinicalModel(): string {
  const configured = process.env.AI_CLINICAL_MODEL?.trim() ?? "";
  if (provider() === "openai") {
    if (!configured) {
      if (isProductionRuntime()) {
        throw new Error("Missing required environment variable: AI_CLINICAL_MODEL");
      }
      // Dev/test uniquement — modèle V1 explicite, jamais gpt-4.1-mini.
      return V1_CLINICAL_MODEL_DEV_FALLBACK;
    }
    return configured;
  }
  return configured || "fake-clinical";
}

export function getTranscribeModel(): string {
  const configured = process.env.AI_TRANSCRIBE_MODEL?.trim() ?? "";
  if (provider() === "openai") {
    if (!configured) {
      if (isProductionRuntime()) {
        throw new Error("Missing required environment variable: AI_TRANSCRIBE_MODEL");
      }
      return V1_TRANSCRIBE_MODEL_DEV_FALLBACK;
    }
    return configured;
  }
  return configured || "fake-transcribe";
}
