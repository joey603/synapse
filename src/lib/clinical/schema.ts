import { z } from "zod";

import {
  EVIDENCE_TIMES,
  EVOLUTIONS,
  FACT_DOMAINS,
  SPEAKERS,
  emptyFact,
  type ClinicalFact,
  type Contradiction,
  type ContradictionKind,
  type EvidenceItem,
  type Evolution,
  type FactDomain,
  type MedicationDiscrepancy,
  type StoredExtraction,
} from "@/lib/clinical/types";

const assertion = z.enum(["present", "explicitly_denied", "not_assessed", "not_reported", "uncertain"]);
const temporality = z.enum(["current_visit", "historical", "unknown"]);
const source = z.enum(["transcript", "patient_record", "previous_validated_visit"]);
const confidence = z.enum(["high", "medium", "low"]);
const speaker = z.enum(SPEAKERS);
const evidenceTime = z.enum(EVIDENCE_TIMES);

const evidenceItemSchema = z.object({
  quote: z.string(),
  speaker: speaker.optional(),
  source: z.string().optional(),
  temporality: evidenceTime.optional(),
});

const legacyEvidence = z.object({ quote: z.string() });

export const clinicalFactSchema = z.object({
  value: z.string().nullable().optional(),
  assertion: assertion.optional(),
  temporality: temporality.optional(),
  source: source.optional(),
  evidence: z.union([legacyEvidence, z.array(evidenceItemSchema)]).nullable().optional(),
  evidences: z.array(evidenceItemSchema).optional(),
  confidence: confidence.optional(),
});

const citedSchema = z.object({
  text: z.string(),
  evidence: z.array(evidenceItemSchema).optional(),
  quote: z.string().optional(),
});

export const extractionSchema = z.object({
  facts: z.record(z.string(), clinicalFactSchema).optional(),
  medicationMentions: z.array(clinicalFactSchema).optional(),
  longitudinal: z.record(z.string(), z.string()).optional(),
  interventions: z.array(citedSchema).optional(),
  plan: z.array(citedSchema).optional(),
  contradictions: z.array(z.object({
    kind: z.string().optional(),
    summary: z.string().optional(),
    evidence: z.array(evidenceItemSchema).optional(),
  })).optional(),
  medicationDiscrepancies: z.array(z.object({
    medication: z.string().optional(),
    recordDose: z.string().nullable().optional(),
    reportedDose: z.string().optional(),
    evidence: z.array(evidenceItemSchema).optional(),
  })).optional(),
  pointsToVerify: z.array(z.string()).optional(),
  suggestedTasks: z.array(z.string()).optional(),
  finalReportHe: z.string().nullable().optional(),
});

export function coerceFact(raw: z.infer<typeof clinicalFactSchema> | undefined): ClinicalFact {
  const base = emptyFact();
  if (!raw) return base;
  const evidences = readEvidences(raw);
  const current = evidences.find((item) => item.temporality === "CURRENT");
  return {
    value: raw.value?.trim() ? raw.value.trim().slice(0, 500) : null,
    assertion: raw.assertion ?? base.assertion,
    temporality: raw.temporality ?? (current ? "current_visit" : base.temporality),
    // SourceKind legacy (transcript/patient_record/…) ≠ EvidenceSource (TRANSCRIPT/NURSE_NOTE).
    // Ne jamais requalifier NURSE_NOTE en « transcript » ici.
    source: raw.source ?? base.source,
    evidence: current ? { quote: current.quote } : null,
    evidences,
    confidence: raw.confidence ?? base.confidence,
  };
}

export function coerceExtraction(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  // Parse souple : un domaine inventé / mal formé par OpenAI ne doit pas faire échouer toute l’extraction.
  const factsBag = asRecord(data.facts);
  const facts = {} as Record<FactDomain, ClinicalFact>;
  for (const domain of FACT_DOMAINS) {
    facts[domain] = coerceFact(normalizeFactRaw(factsBag[domain]));
  }

  const longitudinal: Partial<Record<FactDomain, Evolution>> = {};
  const longitudinalRaw = asRecord(data.longitudinal);
  for (const domain of FACT_DOMAINS) {
    const value = longitudinalRaw[domain];
    if (typeof value === "string" && (EVOLUTIONS as readonly string[]).includes(value)) {
      longitudinal[domain] = value as Evolution;
    }
  }

  const medicationMentions = asArray(data.medicationMentions)
    .map((item) => coerceFact(normalizeFactRaw(item)))
    .slice(0, 12);

  const interventions = asArray(data.interventions)
    .map((item) => {
      const parsed = citedSchema.safeParse(item);
      return parsed.success ? readCited(parsed.data) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.text))
    .slice(0, 16);

  const plan = asArray(data.plan)
    .map((item) => {
      const parsed = citedSchema.safeParse(item);
      return parsed.success ? readCited(parsed.data) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.text))
    .slice(0, 16);

  const contradictions = asArray(data.contradictions)
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      return readContradiction(item as { kind?: string; summary?: string; evidence?: z.infer<typeof evidenceItemSchema>[] });
    })
    .slice(0, 12);

  const medicationDiscrepancies = asArray(data.medicationDiscrepancies)
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      return readDiscrepancy(item as {
        medication?: string;
        recordDose?: string | null;
        reportedDose?: string;
        evidence?: z.infer<typeof evidenceItemSchema>[];
      });
    })
    .slice(0, 12);

  return {
    facts,
    medicationMentions,
    longitudinal,
    interventions,
    plan,
    contradictions,
    medicationDiscrepancies,
    pointsToVerify: cleanLines(asStringArray(data.pointsToVerify)),
    suggestedTasks: cleanLines(asStringArray(data.suggestedTasks)),
    finalReportHe: typeof data.finalReportHe === "string" ? data.finalReportHe.trim() || null : null,
  };
}

function normalizeFactRaw(value: unknown): z.infer<typeof clinicalFactSchema> | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = clinicalFactSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function parseStored(payload: unknown): StoredExtraction | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Partial<StoredExtraction>;
  if (!value.facts?.suicidality?.assertion) return null;
  const facts = {} as Record<FactDomain, ClinicalFact>;
  for (const domain of FACT_DOMAINS) {
    const fact = value.facts[domain] ?? emptyFact();
    facts[domain] = { ...emptyFact(), ...fact, evidences: fact.evidences ?? [] };
  }
  return {
    facts,
    medicationMentions: value.medicationMentions ?? [],
    changes: value.changes ?? [],
    reviewFlags: value.reviewFlags ?? [],
    downgraded: value.downgraded ?? [],
    longitudinal: value.longitudinal ?? {},
    interventions: value.interventions ?? [],
    plan: value.plan ?? [],
    contradictions: value.contradictions ?? [],
    medicationDiscrepancies: value.medicationDiscrepancies ?? [],
    pointsToVerify: value.pointsToVerify ?? [],
    suggestedTasks: value.suggestedTasks ?? [],
    finalReportHe: value.finalReportHe ?? null,
  };
}

function readEvidences(raw: z.infer<typeof clinicalFactSchema>): EvidenceItem[] {
  const listed = raw.evidences ?? (Array.isArray(raw.evidence) ? raw.evidence : []);
  const fromList = listed.map(readEvidence).filter((item): item is EvidenceItem => item != null);
  if (fromList.length > 0) return fromList.slice(0, 8);
  if (raw.evidence && !Array.isArray(raw.evidence) && raw.evidence.quote?.trim()) {
    return [{
      quote: raw.evidence.quote.trim().slice(0, 400),
      speaker: "PATIENT",
      source: "TRANSCRIPT",
      temporality: "CURRENT",
    }];
  }
  return [];
}

function readEvidence(raw: z.infer<typeof evidenceItemSchema> & { source?: string }): EvidenceItem | null {
  const quote = raw.quote?.trim().slice(0, 400);
  if (!quote) return null;
  return {
    quote,
    speaker: raw.speaker ?? "UNKNOWN",
    source: normalizeEvidenceSource(raw.source),
    temporality: raw.temporality ?? "CURRENT",
  };
}

/** Normalise les conventions legacy (`transcript`, `nurse_note`) → TRANSCRIPT / NURSE_NOTE. */
export function normalizeEvidenceSource(raw: string | undefined | null): EvidenceItem["source"] {
  const value = (raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (value === "NURSE_NOTE" || value === "NURSENOTE") return "NURSE_NOTE";
  if (value === "TRANSCRIPT") return "TRANSCRIPT";
  // Legacy minuscule / variantes
  const lower = (raw ?? "").trim().toLowerCase();
  if (lower === "nurse_note" || lower === "nursenote" || lower === "nurse note") return "NURSE_NOTE";
  if (lower === "transcript") return "TRANSCRIPT";
  return "TRANSCRIPT";
}

function readCited(raw: z.infer<typeof citedSchema>) {
  const evidence = (raw.evidence ?? []).map(readEvidence).filter((item): item is EvidenceItem => item != null);
  if (evidence.length === 0 && raw.quote?.trim()) {
    evidence.push({
      quote: raw.quote.trim().slice(0, 400),
      speaker: "UNKNOWN",
      source: "TRANSCRIPT",
      temporality: "CURRENT",
    });
  }
  return { text: raw.text.trim().slice(0, 400), evidence };
}

const CONTRADICTION_KINDS = ["patient_family", "patient_chart", "medication", "today_history", "same_interview", "other"] as const;

function readContradiction(raw: { kind?: string; summary?: string; evidence?: z.infer<typeof evidenceItemSchema>[] }): Contradiction[] {
  const summary = raw.summary?.trim().slice(0, 400);
  if (!summary) return [];
  const kind = (CONTRADICTION_KINDS as readonly string[]).includes(raw.kind ?? "")
    ? (raw.kind as ContradictionKind)
    : "other";
  return [{
    kind,
    summary,
    evidence: (raw.evidence ?? []).map(readEvidence).filter((item): item is EvidenceItem => item != null),
  }];
}

function readDiscrepancy(raw: {
  medication?: string;
  recordDose?: string | null;
  reportedDose?: string;
  evidence?: z.infer<typeof evidenceItemSchema>[];
}): MedicationDiscrepancy[] {
  const medication = raw.medication?.trim().slice(0, 120);
  const reportedDose = raw.reportedDose?.trim().slice(0, 80);
  if (!medication || !reportedDose) return [];
  return [{
    medication,
    recordDose: raw.recordDose?.trim().slice(0, 80) || null,
    reportedDose,
    requiresHumanReview: true,
    evidence: (raw.evidence ?? []).map(readEvidence).filter((item): item is EvidenceItem => item != null),
  }];
}

function cleanLines(values: string[] | undefined) {
  return (values ?? []).map((item) => item.trim().slice(0, 240)).filter(Boolean).slice(0, 12);
}
