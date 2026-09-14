export const FACT_DOMAINS = [
  "mood",
  "affect",
  "anxiety",
  "sleep",
  "appetite",
  "activity",
  "functioning",
  "work",
  "family",
  "isolation",
  "speech",
  "thought",
  "thoughtContent",
  "delusions",
  "hallucinations",
  "psychosis",
  "agitation",
  "retardation",
  "impulsivity",
  "behavior",
  "insight",
  "judgment",
  "adherence",
  "sideEffects",
  "substanceUse",
  "suicidality",
  "suicideIntent",
  "suicidePlan",
  "recentSuicidalBehavior",
  "selfHarm",
  "aggression",
  "dangerousness",
  "protectiveFactors",
] as const;

export type FactDomain = (typeof FACT_DOMAINS)[number];

export const RISK_DOMAINS = [
  "suicidality",
  "suicideIntent",
  "suicidePlan",
  "recentSuicidalBehavior",
  "selfHarm",
  "psychosis",
  "aggression",
  "impulsivity",
  "dangerousness",
  "substanceUse",
  "sideEffects",
] as const satisfies readonly FactDomain[];

export const CLINICAL_DOMAINS = [
  "mood",
  "affect",
  "anxiety",
  "sleep",
  "appetite",
  "activity",
  "functioning",
  "work",
  "isolation",
  "family",
] as const satisfies readonly FactDomain[];

export const EXAM_DOMAINS = [
  "behavior",
  "speech",
  "thought",
  "thoughtContent",
  "delusions",
  "hallucinations",
  "agitation",
  "retardation",
  "insight",
  "judgment",
] as const satisfies readonly FactDomain[];

export type Assertion = "present" | "explicitly_denied" | "not_assessed" | "not_reported" | "uncertain";
export type Temporality = "current_visit" | "historical" | "unknown";
export type SourceKind = "transcript" | "patient_record" | "previous_validated_visit";
export type Confidence = "high" | "medium" | "low";

export const SPEAKERS = ["PATIENT", "FAMILY", "NURSE", "OTHER_CLINICIAN", "UNKNOWN"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const EVIDENCE_SOURCES = ["TRANSCRIPT", "NURSE_NOTE"] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const EVIDENCE_TIMES = ["CURRENT", "RECENT_PAST", "HISTORICAL", "UNCLEAR"] as const;
export type EvidenceTime = (typeof EVIDENCE_TIMES)[number];

export const EVOLUTIONS = ["improved", "worsened", "stable", "new", "resolved", "unclear", "not_reassessed"] as const;
export type Evolution = (typeof EVOLUTIONS)[number];

export type EvidenceItem = {
  quote: string;
  speaker: Speaker;
  source: EvidenceSource;
  temporality: EvidenceTime;
};

export type ClinicalFact = {
  value: string | null;
  assertion: Assertion;
  temporality: Temporality;
  source: SourceKind;
  evidence: { quote: string } | null;
  evidences: EvidenceItem[];
  confidence: Confidence;
};

export type ReviewFlagCode =
  | "suicide_mentioned"
  | "suicide_uncertain"
  | "dose_uncertain"
  | "medication_not_in_chart"
  | "chart_medication_not_mentioned"
  | "contradiction"
  | "downgraded";

export type ReviewFlag = { code: ReviewFlagCode; domain?: string };

export type ExtractionChange = {
  domain: FactDomain;
  from: Assertion;
  to: Assertion;
};

export type CitedItem = {
  text: string;
  evidence: EvidenceItem[];
};

export type ContradictionKind =
  | "patient_family"
  | "patient_chart"
  | "medication"
  | "today_history"
  | "same_interview"
  | "other";

export type Contradiction = {
  kind: ContradictionKind;
  summary: string;
  evidence: EvidenceItem[];
};

export type MedicationDiscrepancy = {
  medication: string;
  recordDose: string | null;
  reportedDose: string;
  requiresHumanReview: true;
};

export type StoredExtraction = {
  facts: Record<FactDomain, ClinicalFact>;
  medicationMentions: ClinicalFact[];
  changes: ExtractionChange[];
  reviewFlags: ReviewFlag[];
  downgraded: string[];
  longitudinal: Partial<Record<FactDomain, Evolution>>;
  interventions: CitedItem[];
  plan: CitedItem[];
  contradictions: Contradiction[];
  medicationDiscrepancies: MedicationDiscrepancy[];
  pointsToVerify: string[];
  suggestedTasks: string[];
  finalReportHe: string | null;
};

export function emptyFact(): ClinicalFact {
  return {
    value: null,
    assertion: "not_assessed",
    temporality: "unknown",
    source: "transcript",
    evidence: null,
    evidences: [],
    confidence: "low",
  };
}

export function currentQuote(fact: ClinicalFact) {
  return fact.evidences.find((item) => item.temporality === "CURRENT")?.quote ?? fact.evidence?.quote ?? null;
}
