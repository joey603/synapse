import type { DrivingRiskStatus, Sex, VisitType } from "@prisma/client";

import { hebrewClinicalText } from "@/lib/clinical/hebrew-text";
import type { ClinicalFact, FactDomain, StoredExtraction } from "@/lib/clinical/types";
import {
  composeMainProblemsProse,
  composePatientStatusProse,
} from "@/lib/clinical/zebra-projection";

const DRIVING_RE = /נהיג|לנהוג|רשיון\s*נהיגה|כביש|הגה|conduite|driving|drive|permis/i;

export type StructuredReportSections = {
  patientStatusNote: string | null;
  drivingRisk: DrivingRiskStatus;
  diagnosisNote: string | null;
  mainProblems: string | null;
  currentMedication: string | null;
  interventionsProvided: string | null;
  carePlan: string | null;
};

export type StructuredComposeInput = {
  extraction: StoredExtraction;
  visitType: VisitType;
  diagnosis: { primary: string | null; secondary: string | null };
  medications: Array<{ name: string; dose: string | null; frequency: string | null }>;
  /** Patient.sex — genre grammatical des formulations hébraïques. */
  sex?: Sex;
};

/**
 * Projette le JSON clinique VALIDÉ + dossier patient vers les champs structurés Zebra.
 * Source unique = extraction validée. N’invente aucun fait. Ne parse jamais finalReportHe.
 * pointsToVerify / contradictions / evidence restent hors champs Zebra (domaine Analyse).
 * patientStatusNote / mainProblems = prose clinique professionnelle (pas dump d’evidence).
 */
export function composeStructuredSections(input: StructuredComposeInput): StructuredReportSections {
  const { extraction } = input;
  const sex = input.sex ?? "UNSPECIFIED";
  return {
    patientStatusNote: composePatientStatusProse(extraction, sex),
    drivingRisk: inferDrivingRisk(extraction),
    diagnosisNote: composeDiagnosis(input.diagnosis),
    mainProblems: composeMainProblemsProse(extraction, sex),
    currentMedication: composeMedication(input.medications, extraction, sex),
    interventionsProvided: composeCitedList(extraction.interventions),
    carePlan: composeCarePlan(extraction),
  };
}

export function inferDrivingRisk(extraction: StoredExtraction): DrivingRiskStatus {
  const hits = collectDrivingEvidence(extraction);
  if (hits.length === 0) return "NOT_ASSESSED";

  const present = hits.filter((item) => item.assertion === "present");
  const denied = hits.filter((item) => item.assertion === "explicitly_denied");
  const uncertain = hits.filter((item) => item.assertion === "uncertain");

  if (present.length > 0) {
    const low = present.every((item) => item.confidence === "low");
    return low ? "POSSIBLE_RISK" : "RISK_IDENTIFIED";
  }
  if (uncertain.length > 0) return "UNCLEAR";
  if (denied.length > 0 && denied.every((item) => item.hasEvidence)) {
    return "NO_RISK_IDENTIFIED";
  }
  return "NOT_ASSESSED";
}

function collectDrivingEvidence(extraction: StoredExtraction) {
  const items: Array<{
    assertion: ClinicalFact["assertion"];
    confidence: ClinicalFact["confidence"];
    hasEvidence: boolean;
  }> = [];
  for (const domain of Object.keys(extraction.facts) as FactDomain[]) {
    const fact = extraction.facts[domain];
    if (!factMentionsDriving(fact)) continue;
    if (fact.temporality === "historical") continue;
    if (!isEncounterFact(fact)) continue;
    items.push({
      assertion: fact.assertion,
      confidence: fact.confidence,
      hasEvidence: Boolean(fact.evidence?.quote || fact.evidences.some((e) => e.temporality === "CURRENT")),
    });
  }
  for (const fact of extraction.medicationMentions) {
    if (!factMentionsDriving(fact)) continue;
    if (fact.temporality === "historical" || !isEncounterFact(fact)) continue;
    items.push({
      assertion: fact.assertion,
      confidence: fact.confidence,
      hasEvidence: Boolean(fact.evidence?.quote),
    });
  }
  return items;
}

function factMentionsDriving(fact: ClinicalFact) {
  const blob = [fact.value, fact.evidence?.quote, ...fact.evidences.map((e) => e.quote)]
    .filter(Boolean)
    .join(" ");
  return DRIVING_RE.test(blob);
}

function composeDiagnosis(diagnosis: { primary: string | null; secondary: string | null }) {
  const lines: string[] = [];
  if (diagnosis.primary?.trim()) lines.push(diagnosis.primary.trim());
  if (diagnosis.secondary?.trim()) lines.push(diagnosis.secondary.trim());
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * A = AUTHORITATIVE TREATMENT (Medication record).
 * B = information rapportée visite, clairement qualifiée — jamais transformée en traitement officiel.
 */
function composeMedication(
  medications: Array<{ name: string; dose: string | null; frequency: string | null }>,
  extraction: StoredExtraction,
  sex: Sex,
) {
  const lines: string[] = [];

  if (medications.length > 0) {
    for (const med of medications) {
      const dose = [med.dose, med.frequency].filter(Boolean).join(" · ");
      lines.push(dose ? `${med.name} — ${dose}` : med.name);
    }
  }

  for (const gap of extraction.medicationDiscrepancies) {
    lines.push(
      `לאימות — ${gap.medication}: רשום ${gap.recordDose ?? "—"} / נמסר ${gap.reportedDose}`,
    );
  }

  const mentions = extraction.medicationMentions.filter((fact) => isEncounterFact(fact));
  const resolved = mentions.map((fact) => resolvePatientReportedMedication(fact));

  if (medications.length === 0) {
    const certain = resolved.filter((item) => item && item.certain);
    const uncertain = resolved.filter((item) => item && !item.certain);
    for (const item of certain) {
      if (!item) continue;
      lines.push(`${patientReportedMedPrefix(sex)}: ${item.label}`);
    }
    if (certain.length === 0 && uncertain.length > 0) {
      lines.push(uncertainMedicationNote(sex));
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function patientReportedMedPrefix(sex: Sex) {
  if (sex === "FEMALE") return "דיווח המטופלת (לא רשום בתיק הטיפול)";
  return "דיווח המטופל (לא רשום בתיק הטיפול)";
}

function uncertainMedicationNote(sex: Sex) {
  if (sex === "FEMALE") {
    return "המטופלת דיווחה על נטילת טיפול תרופתי, אך שם התרופה/המינון לא זוהו בוודאות במהלך הביקור ונדרש בירור.";
  }
  return "המטופל דיווח על נטילת טיפול תרופתי, אך שם התרופה/המינון לא זוהו בוודאות במהלך הביקור ונדרש בירור.";
}

/**
 * Médicament rapporté : nom clair dans la quote → label ; sinon incertitude (sans citation brute Zebra).
 */
function resolvePatientReportedMedication(fact: ClinicalFact): { label: string; certain: boolean } | null {
  if (fact.temporality === "historical") return null;
  if (fact.assertion !== "present" && fact.assertion !== "uncertain") return null;
  const quote =
    fact.evidence?.quote?.trim() ||
    fact.evidences.find((item) => item.temporality === "CURRENT")?.quote?.trim() ||
    null;
  const value = hebrewClinicalText(fact.value);

  if (quote && /בונדורמין|Bondormin|בואנדורמין/i.test(quote)) {
    return { label: "בונדורמין", certain: true };
  }
  if (value && /בונדורמין|Bondormin/i.test(value)) {
    return { label: value, certain: true };
  }
  // Nom garblé / low confidence / uncertain → formulation prudente (pas de « נמסר: «…» »).
  if (fact.assertion === "uncertain" || fact.confidence === "low" || !value) {
    if (quote && /לוקח|נוטל|כדור|תרופ/.test(quote)) {
      return { label: "", certain: false };
    }
    return null;
  }
  return { label: value, certain: true };
}

function composeCitedList(items: Array<{ text: string }>) {
  const lines = items
    .map((item) => hebrewClinicalText(item.text))
    .filter(Boolean) as string[];
  return lines.length > 0 ? lines.map((line) => `• ${line}`).join("\n") : null;
}

/** Travail thérapeutique (« עבודה על », CBT) — pas une recommandation d’emploi. */
const THERAPEUTIC_WORK_RE =
  /עבודה\s+(על|קוגניטיב)|עבודה\s*(CBT|TCC)|המשך\s+עבודה\s+(CBT|על|קוגניטיב)|עבודה\s+עצמית/i;

/**
 * Recommandation d’emploi / domaine fonctionnel « travail » spécifique.
 * Ne doit pas apparaître sans evidence CURRENT documentée (functioning|work|activity).
 */
const EMPLOYMENT_PLAN_RE =
  /(?:^|[\s•\-–—])עבודה(?:$|[\s.,;:!?])|תעסוק|חזרה\s+לעבודה|מקום\s+העבודה|שיקום\s+תעסוק|להגביר\s+עבודה|בעבודה\s+ובתפקוד|מסגרת\s+עבודה|יציאה\s+לעבודה|חיזוק\s+עבודה(?!\s+על)|תפקוד\s+תעסוק/i;

/**
 * Plan : uniquement ce qui est validé. Ne pas introduire un axe emploi « עבודה »
 * si functioning/work/activity n’a pas été documenté comme present CURRENT.
 */
function composeCarePlan(extraction: StoredExtraction) {
  const workDocumented = ["functioning", "work", "activity"].some((domain) => {
    const fact = extraction.facts[domain as FactDomain];
    return (
      fact &&
      fact.assertion === "present" &&
      fact.temporality === "current_visit" &&
      isEncounterFact(fact)
    );
  });

  const lines = extraction.plan
    .map((item) => hebrewClinicalText(item.text))
    .filter((text): text is string => Boolean(text))
    .filter((text) => {
      const trimmed = text.trim();
      if (trimmed === "עבודה" || trimmed === "תעסוקה") {
        return workDocumented;
      }
      if (THERAPEUTIC_WORK_RE.test(text)) return true;
      if (EMPLOYMENT_PLAN_RE.test(text)) return workDocumented;
      return true;
    });

  return lines.length > 0 ? lines.map((line) => `• ${line}`).join("\n") : null;
}

function isEncounterFact(fact: ClinicalFact) {
  if (fact.source === "patient_record" || fact.source === "previous_validated_visit") return false;
  return (
    fact.source === "transcript" ||
    fact.evidences.some((item) => item.source === "TRANSCRIPT" || item.source === "NURSE_NOTE")
  );
}
