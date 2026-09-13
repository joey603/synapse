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
  "aggression",
  "dangerousness",
  "protectiveFactors",
] as const;

export type FactDomain = (typeof FACT_DOMAINS)[number];

export const RISK_DOMAINS = [
  "suicidality",
  "psychosis",
  "aggression",
  "substanceUse",
  "sideEffects",
] as const satisfies readonly FactDomain[];

export type Assertion = "present" | "explicitly_denied" | "not_assessed" | "not_reported" | "uncertain";
export type Temporality = "current_visit" | "historical" | "unknown";
export type SourceKind = "transcript" | "patient_record" | "previous_validated_visit";
export type Confidence = "high" | "medium" | "low";

export type ClinicalFact = {
  value: string | null;
  assertion: Assertion;
  temporality: Temporality;
  source: SourceKind;
  evidence: { quote: string } | null;
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

export type StoredExtraction = {
  facts: Record<FactDomain, ClinicalFact>;
  medicationMentions: ClinicalFact[];
  changes: ExtractionChange[];
  reviewFlags: ReviewFlag[];
  downgraded: string[];
};

export function emptyFact(): ClinicalFact {
  return {
    value: null,
    assertion: "not_assessed",
    temporality: "unknown",
    source: "transcript",
    evidence: null,
    confidence: "low",
  };
}
