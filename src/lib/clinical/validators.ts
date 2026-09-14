import { coerceExtraction } from "@/lib/clinical/schema";
import {
  FACT_DOMAINS,
  RISK_DOMAINS,
  type ClinicalFact,
  type EvidenceItem,
  type Evolution,
  type FactDomain,
  type StoredExtraction,
} from "@/lib/clinical/types";
import { currentQuote } from "@/lib/clinical/types";

const DOCUMENTED = new Set(["present", "explicitly_denied"]);
const TRAJECTORY = new Set<Evolution>(["improved", "worsened", "stable", "new", "resolved"]);

export function validateExtraction(
  raw: unknown,
  transcript: string,
  nurseNotes = "",
): StoredExtraction | null {
  const coerced = coerceExtraction(raw);
  if (!coerced) return null;

  const downgraded: string[] = [];
  const points = [...coerced.pointsToVerify];
  const facts = {} as Record<FactDomain, ClinicalFact>;

  for (const domain of FACT_DOMAINS) {
    facts[domain] = applyRules(coerced.facts[domain], transcript, nurseNotes, domain, downgraded);
  }

  return {
    facts,
    medicationMentions: coerced.medicationMentions.map((fact, index) =>
      applyRules(fact, transcript, nurseNotes, `medication:${index}`, downgraded, true),
    ),
    changes: [],
    reviewFlags: [],
    downgraded,
    longitudinal: gateLongitudinal(coerced.longitudinal, facts),
    interventions: keepCited(coerced.interventions, transcript, nurseNotes),
    plan: keepCited(coerced.plan, transcript, nurseNotes),
    contradictions: keepContradictions(coerced.contradictions, transcript, nurseNotes, points),
    medicationDiscrepancies: keepDiscrepancies(coerced.medicationDiscrepancies, transcript, points),
    pointsToVerify: points.slice(0, 12),
    suggestedTasks: coerced.suggestedTasks,
    finalReportHe: coerced.finalReportHe,
  };
}

function applyRules(
  fact: ClinicalFact,
  transcript: string,
  nurseNotes: string,
  key: string,
  downgraded: string[],
  medication = false,
): ClinicalFact {
  const evidences = fact.evidences.filter((item) => quoteFound(item, transcript, nurseNotes));
  const current = evidences.filter((item) => item.temporality === "CURRENT");
  let assertion = fact.assertion;

  if (assertion === "not_assessed" || assertion === "not_reported") {
    return finish({ ...fact, evidences, evidence: null }, medication);
  }

  if (assertion === "present" || assertion === "explicitly_denied") {
    const support = current.filter((item) => supports(assertion, item, key));
    if (support.length === 0) {
      downgraded.push(key);
      return finish({
        ...fact,
        assertion: "uncertain",
        value: null,
        evidence: null,
        evidences,
        confidence: "low",
        temporality: "unknown",
      }, medication);
    }
  }

  const quote = current[0]?.quote ?? null;
  return finish({
    ...fact,
    evidences,
    evidence: quote ? { quote } : null,
    temporality: current.length > 0 ? "current_visit" : fact.temporality,
    source: current[0]?.source === "NURSE_NOTE" ? "transcript" : fact.source,
  }, medication);
}

function supports(assertion: ClinicalFact["assertion"], item: EvidenceItem, key: string) {
  if (assertion !== "explicitly_denied") return true;
  if (isRiskKey(key)) return item.speaker === "PATIENT";
  return item.speaker === "PATIENT" || item.speaker === "NURSE";
}

function isRiskKey(key: string) {
  return (RISK_DOMAINS as readonly string[]).includes(key);
}

function finish(fact: ClinicalFact, medication: boolean): ClinicalFact {
  const next = stripLooseDose(fact, medication);
  if (!next.evidence && currentQuote(next)) {
    return { ...next, evidence: { quote: currentQuote(next)! } };
  }
  return next;
}

function gateLongitudinal(
  proposed: Partial<Record<FactDomain, Evolution>>,
  facts: Record<FactDomain, ClinicalFact>,
) {
  const next: Partial<Record<FactDomain, Evolution>> = {};
  for (const domain of FACT_DOMAINS) {
    const value = proposed[domain];
    if (!value) continue;
    const documented = DOCUMENTED.has(facts[domain].assertion);
    if (!documented && TRAJECTORY.has(value)) {
      next[domain] = "not_reassessed";
      continue;
    }
    next[domain] = value;
  }
  return next;
}

function keepCited(
  items: StoredExtraction["interventions"],
  transcript: string,
  nurseNotes: string,
) {
  return items
    .map((item) => ({ ...item, evidence: item.evidence.filter((proof) => quoteFound(proof, transcript, nurseNotes)) }))
    .filter((item) => item.text && item.evidence.length > 0);
}

function keepContradictions(
  items: StoredExtraction["contradictions"],
  transcript: string,
  nurseNotes: string,
  points: string[],
) {
  const kept = [];
  for (const item of items) {
    const evidence = item.evidence.filter((proof) => quoteFound(proof, transcript, nurseNotes));
    if (evidence.length === 0) {
      points.push(item.summary);
      continue;
    }
    kept.push({ ...item, evidence });
  }
  return kept;
}

function keepDiscrepancies(
  items: StoredExtraction["medicationDiscrepancies"],
  transcript: string,
  points: string[],
) {
  return items.flatMap((item) => {
    const spoken = item.reportedDose;
    const number = spoken.match(/\d+/)?.[0];
    if (
      !quoteInTranscript(spoken, transcript) &&
      !quoteInTranscript(item.medication, transcript) &&
      !(number && transcript.includes(number))
    ) {
      points.push(`${item.medication}: ${spoken}`);
      return [];
    }
    return [{ ...item, requiresHumanReview: true as const }];
  });
}

function quoteFound(item: EvidenceItem, transcript: string, nurseNotes: string) {
  const corpus = item.source === "NURSE_NOTE" ? nurseNotes : transcript;
  return quoteInTranscript(item.quote, corpus);
}

function stripLooseDose(fact: ClinicalFact, medication: boolean): ClinicalFact {
  if (fact.confidence === "high" && medication) return fact;
  if (!fact.value) return fact;
  if (!/\d/.test(fact.value)) return fact;
  if (!medication && fact.confidence === "high") return fact;
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
