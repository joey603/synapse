import "server-only";

import { fakeClinical, fakeTranscription } from "@/lib/ai/fake";
import { openaiClinical, openaiTranscription } from "@/lib/ai/openai";
import type { ClinicalLanguageProvider, TranscriptionProvider } from "@/lib/ai/types";

export function getTranscriptionProvider(): TranscriptionProvider {
  return provider() === "openai" ? openaiTranscription : fakeTranscription;
}

export function getClinicalProvider(): ClinicalLanguageProvider {
  return provider() === "openai" ? openaiClinical : fakeClinical;
}

export function providerName() {
  return provider();
}

function provider() {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "fake";
}
