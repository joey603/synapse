import { z } from "zod";

import { FACT_DOMAINS, emptyFact, type ClinicalFact, type FactDomain, type StoredExtraction } from "@/lib/clinical/types";

const assertion = z.enum(["present", "explicitly_denied", "not_assessed", "not_reported", "uncertain"]);
const temporality = z.enum(["current_visit", "historical", "unknown"]);
const source = z.enum(["transcript", "patient_record", "previous_validated_visit"]);
const confidence = z.enum(["high", "medium", "low"]);

export const clinicalFactSchema = z.object({
  value: z.string().nullable().optional(),
  assertion: assertion.optional(),
  temporality: temporality.optional(),
  source: source.optional(),
  evidence: z.object({ quote: z.string() }).nullable().optional(),
  confidence: confidence.optional(),
});

export const extractionSchema = z.object({
  facts: z.record(z.string(), clinicalFactSchema).optional(),
  medicationMentions: z.array(clinicalFactSchema).optional(),
});

export function coerceFact(raw: z.infer<typeof clinicalFactSchema> | undefined): ClinicalFact {
  const base = emptyFact();
  if (!raw) return base;
  return {
    value: raw.value?.trim() ? raw.value.trim().slice(0, 500) : null,
    assertion: raw.assertion ?? base.assertion,
    temporality: raw.temporality ?? base.temporality,
    source: raw.source ?? base.source,
    evidence: raw.evidence?.quote?.trim() ? { quote: raw.evidence.quote.trim().slice(0, 400) } : null,
    confidence: raw.confidence ?? base.confidence,
  };
}

export function coerceExtraction(raw: unknown) {
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) return null;

  const facts = {} as Record<FactDomain, ClinicalFact>;
  for (const domain of FACT_DOMAINS) {
    facts[domain] = coerceFact(parsed.data.facts?.[domain]);
  }

  return {
    facts,
    medicationMentions: (parsed.data.medicationMentions ?? []).map((item) => coerceFact(item)).slice(0, 12),
  };
}

export function parseStored(payload: unknown): StoredExtraction | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Partial<StoredExtraction>;
  if (!value.facts?.suicidality?.assertion) return null;
  const facts = {} as Record<FactDomain, ClinicalFact>;
  for (const domain of FACT_DOMAINS) {
    facts[domain] = value.facts[domain] ?? emptyFact();
  }
  return {
    facts,
    medicationMentions: value.medicationMentions ?? [],
    changes: value.changes ?? [],
    reviewFlags: value.reviewFlags ?? [],
    downgraded: value.downgraded ?? [],
  };
}
