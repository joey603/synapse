import type { StoredExtraction } from "@/lib/clinical/types";
import type { VisitType } from "@prisma/client";

export type TranscribeResult = {
  text: string;
  detectedLanguage: string | null;
  model: string;
};

export type RewriteAction = "shorten" | "more_clinical" | "correct_hebrew";

export type WriteReportInput = {
  extraction: StoredExtraction;
  transcript?: string;
  nurseNotes?: string | null;
  context?: string;
  visitType?: VisitType;
  occurredAt?: Date;
  patientName?: string;
};

export interface TranscriptionProvider {
  transcribe(input: { audio: Buffer; mimeType: string; filename: string | null }): Promise<TranscribeResult>;
}

export interface ClinicalLanguageProvider {
  extract(input: { transcript: string; context: string }): Promise<unknown>;
  writeReport(input: WriteReportInput): Promise<{ text: string; model: string }>;
  generateReport(input: WriteReportInput & {
    visitType: VisitType;
    occurredAt: Date;
    patientName: string;
  }): Promise<{ text: string; model: string }>;
  rewrite(input: { text: string; action: RewriteAction; extraction: StoredExtraction }): Promise<{ text: string; model: string }>;
}
