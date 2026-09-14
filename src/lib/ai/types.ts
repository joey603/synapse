import type { StoredExtraction } from "@/lib/clinical/types";
import type { VisitType } from "@prisma/client";

export type TranscribeResult = {
  text: string;
  detectedLanguage: string | null;
  model: string;
};

export type RewriteAction = "shorten" | "more_clinical" | "correct_hebrew";

export interface TranscriptionProvider {
  transcribe(input: { audio: Buffer; mimeType: string; filename: string | null }): Promise<TranscribeResult>;
}

export interface ClinicalLanguageProvider {
  extract(input: { transcript: string; context: string }): Promise<unknown>;
  writeReport(input: { extraction: StoredExtraction }): Promise<{ text: string; model: string }>;
  generateReport(input: {
    extraction: StoredExtraction;
    visitType: VisitType;
    occurredAt: Date;
    patientName: string;
  }): Promise<{ text: string; model: string }>;
  rewrite(input: { text: string; action: RewriteAction; extraction: StoredExtraction }): Promise<{ text: string; model: string }>;
}
