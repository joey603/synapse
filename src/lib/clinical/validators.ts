import { coerceExtraction } from "@/lib/clinical/schema";
import {
  FACT_DOMAINS,
  RISK_DOMAINS,
  type ClinicalFact,
  type EvidenceItem,
  type Evolution,
  type FactDomain,
  type MedicationDiscrepancy,
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

  const medicationMentions = coerced.medicationMentions.map((fact, index) =>
    applyRules(fact, transcript, nurseNotes, `medication:${index}`, downgraded, true),
  );
  const interventions = keepCited(coerced.interventions, transcript, nurseNotes);
  const plan = keepCited(coerced.plan, transcript, nurseNotes);
  const contradictions = keepContradictions(coerced.contradictions, transcript, nurseNotes, points);
  const medicationDiscrepancies = keepDiscrepancies(
    coerced.medicationDiscrepancies,
    transcript,
    nurseNotes,
    points,
  );

  const partial: Pick<
    StoredExtraction,
    "facts" | "medicationMentions" | "interventions" | "plan" | "contradictions" | "medicationDiscrepancies"
  > = {
    facts,
    medicationMentions,
    interventions,
    plan,
    contradictions,
    medicationDiscrepancies,
  };

  return {
    facts,
    medicationMentions,
    changes: [],
    reviewFlags: [],
    downgraded,
    longitudinal: gateLongitudinal(coerced.longitudinal, facts),
    interventions,
    plan,
    contradictions,
    medicationDiscrepancies,
    pointsToVerify: points.slice(0, 12),
    suggestedTasks: keepSuggestedTasks(coerced.suggestedTasks, transcript, nurseNotes, partial),
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
  const assertion = fact.assertion;

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
    // Conserver SourceKind tel quel — ne jamais mapper NURSE_NOTE → « transcript ».
    // La provenance documentaire reste dans evidences[].source (TRANSCRIPT | NURSE_NOTE).
    source: fact.source,
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

/**
 * Conserve une divergence médicamenteuse si une preuve explicite existe
 * dans TRANSCRIPT ou NURSE_NOTE. Ne résout jamais quelle dose est correcte.
 */
function keepDiscrepancies(
  items: MedicationDiscrepancy[],
  transcript: string,
  nurseNotes: string,
  points: string[],
): MedicationDiscrepancy[] {
  return items.flatMap((item) => {
    const evidence = (item.evidence ?? []).filter((proof) => quoteFound(proof, transcript, nurseNotes));
    const supportedByEvidence = evidence.length > 0;
    const supportedByCorpus =
      anchoredInSources(item.reportedDose, transcript, nurseNotes) ||
      anchoredInSources(item.medication, transcript, nurseNotes) ||
      doseNumberInSources(item.reportedDose, transcript, nurseNotes);

    if (!supportedByEvidence && !supportedByCorpus) {
      points.push(`${item.medication}: ${item.reportedDose}`);
      return [];
    }

    return [{
      ...item,
      evidence,
      requiresHumanReview: true as const,
    }];
  });
}

/**
 * Garde déterministe léger : une suggestedTask n’est conservée que si elle
 * est ancrée dans TRANSCRIPT, NURSE_NOTE, ou un élément déjà validé.
 * Ne crée jamais de Task réelle.
 */
function keepSuggestedTasks(
  tasks: string[],
  transcript: string,
  nurseNotes: string,
  validated: Pick<
    StoredExtraction,
    "facts" | "medicationMentions" | "interventions" | "plan" | "contradictions" | "medicationDiscrepancies"
  >,
): string[] {
  const anchors = collectValidatedAnchors(validated);
  return tasks.filter((task) => {
    if (anchoredInSources(task, transcript, nurseNotes)) return true;
    return anchors.some((anchor) => sharesSignificantToken(task, anchor));
  });
}

function collectValidatedAnchors(
  validated: Pick<
    StoredExtraction,
    "facts" | "medicationMentions" | "interventions" | "plan" | "contradictions" | "medicationDiscrepancies"
  >,
): string[] {
  const anchors: string[] = [];
  for (const domain of FACT_DOMAINS) {
    const fact = validated.facts[domain];
    if (fact.assertion !== "present" && fact.assertion !== "explicitly_denied") continue;
    if (fact.value) anchors.push(fact.value);
    for (const item of fact.evidences) anchors.push(item.quote);
    if (fact.evidence?.quote) anchors.push(fact.evidence.quote);
  }
  for (const fact of validated.medicationMentions) {
    if (fact.value) anchors.push(fact.value);
    for (const item of fact.evidences) anchors.push(item.quote);
  }
  for (const item of validated.interventions) {
    anchors.push(item.text);
    for (const proof of item.evidence) anchors.push(proof.quote);
  }
  for (const item of validated.plan) {
    anchors.push(item.text);
    for (const proof of item.evidence) anchors.push(proof.quote);
  }
  for (const item of validated.contradictions) {
    anchors.push(item.summary);
    for (const proof of item.evidence) anchors.push(proof.quote);
  }
  for (const item of validated.medicationDiscrepancies) {
    anchors.push(item.medication, item.reportedDose);
    if (item.recordDose) anchors.push(item.recordDose);
  }
  return anchors.filter(Boolean);
}

function anchoredInSources(text: string, transcript: string, nurseNotes: string) {
  return quoteInTranscript(text, transcript) || quoteInTranscript(text, nurseNotes) || sharesSignificantToken(text, `${transcript} ${nurseNotes}`);
}

function doseNumberInSources(spoken: string, transcript: string, nurseNotes: string) {
  const number = spoken.match(/\d+/)?.[0];
  if (!number) return false;
  return transcript.includes(number) || nurseNotes.includes(number);
}

function sharesSignificantToken(left: string, right: string) {
  const rightNorm = normalize(right);
  if (!rightNorm) return false;
  const tokens = significantTokens(left);
  if (tokens.length === 0) return false;
  return tokens.some((token) => rightNorm.includes(token));
}

function significantTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4)
    .filter((token) => !STOP_TOKENS.has(token));
}

const STOP_TOKENS = new Set([
  "avec", "sans", "pour", "dans", "cette", "cela", "aussi", "plus", "moins",
  "demander", "suivre", "faire", "avoir", "etre", "être",
  "מעקב", "לבדוק", "לוודא", "לקבוע", "ביצוע", "המשך",
]);

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
