import { coerceExtraction } from "@/lib/clinical/schema";
import {
  FACT_DOMAINS,
  type ClinicalFact,
  type FactDomain,
  type StoredExtraction,
} from "@/lib/clinical/types";

export function validateExtraction(raw: unknown, transcript: string): StoredExtraction | null {
  const coerced = coerceExtraction(raw);
  if (!coerced) return null;

  const downgraded: string[] = [];
  const facts = {} as Record<FactDomain, ClinicalFact>;

  for (const domain of FACT_DOMAINS) {
    facts[domain] = applyRules(coerced.facts[domain], transcript, domain, downgraded);
  }

  return {
    facts,
    medicationMentions: coerced.medicationMentions.map((fact, index) =>
      applyRules(fact, transcript, `medication:${index}`, downgraded, true),
    ),
    changes: [],
    reviewFlags: [],
    downgraded,
  };
}

function applyRules(
  fact: ClinicalFact,
  transcript: string,
  key: string,
  downgraded: string[],
  medication = false,
): ClinicalFact {
  const next = { ...fact, evidence: fact.evidence ? { ...fact.evidence } : null };

  if (next.source !== "transcript") {
    next.temporality = "historical";
  }

  if (next.assertion === "not_assessed" || next.assertion === "not_reported") {
    next.evidence = null;
    return stripLooseDose(next, medication);
  }

  if (next.assertion === "present" || next.assertion === "explicitly_denied") {
    const quote = next.evidence?.quote ?? "";
    if (!quote || !quoteInTranscript(quote, transcript)) {
      downgraded.push(key);
      return {
        ...next,
        assertion: "uncertain",
        value: null,
        evidence: null,
        confidence: "low",
        temporality: "unknown",
      };
    }
  }

  return stripLooseDose(next, medication);
}

function stripLooseDose(fact: ClinicalFact, medication: boolean): ClinicalFact {
  if (!medication && fact.confidence === "high") return fact;
  if (fact.confidence === "high" && !medication) return fact;
  if (!fact.value) return fact;
  if (fact.confidence === "high" && medication) return fact;
  if (!/\d/.test(fact.value)) return fact;
  const stripped = fact.value.replace(/\d+([.,]\d+)?/g, "").replace(/\s+/g, " ").trim();
  return { ...fact, value: stripped || null, confidence: "low" };
}

export function quoteInTranscript(quote: string, transcript: string) {
  const needle = normalize(quote);
  if (needle.length < 2) return false;
  return normalize(transcript).includes(needle);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
