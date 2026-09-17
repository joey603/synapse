import type { DrivingRiskStatus, VisitType } from "@prisma/client";

import type { ClinicalFact, FactDomain, StoredExtraction } from "@/lib/clinical/types";
import { CLINICAL_DOMAINS, EXAM_DOMAINS, RISK_DOMAINS } from "@/lib/clinical/types";

const DOMAIN_HE: Partial<Record<FactDomain, string>> = {
  mood: "מצב רוח",
  affect: "אפקט",
  anxiety: "חרדה",
  sleep: "שינה",
  appetite: "תיאבון",
  activity: "פעילות",
  functioning: "תפקוד",
  work: "עבודה",
  family: "משפחה",
  isolation: "בידוד",
  speech: "דיבור",
  thought: "מהלך חשיבה",
  thoughtContent: "תוכן חשיבה",
  delusions: "מחשבות שווא",
  hallucinations: "הזיות",
  psychosis: "פסיכוזה",
  agitation: "אי-שקט",
  retardation: "האטה",
  insight: "תובנה",
  judgment: "שיפוט",
  behavior: "התנהגות",
  adherence: "היענות",
  sideEffects: "תופעות לוואי",
  substanceUse: "שימוש בחומרים",
  suicidality: "מחשבות אובדניות",
  suicideIntent: "כוונה אובדנית",
  suicidePlan: "תכנית אובדנית",
  recentSuicidalBehavior: "התנהגות אובדנית לאחרונה",
  selfHarm: "פגיעה עצמית",
  aggression: "אלימות",
  dangerousness: "מסוכנות",
  protectiveFactors: "גורמים מגינים",
  impulsivity: "אימפולסיביות",
};

const EVOLUTION_HE: Record<string, string> = {
  improved: "שיפור",
  worsened: "החמרה",
  stable: "יציב",
  new: "חדש",
  resolved: "נפתר",
  unclear: "לא ברור",
  not_reassessed: "לא הוערך מחדש",
};

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
};

/**
 * Projette le JSON clinique validé + dossier patient vers les champs structurés hébreux.
 * N’invente aucun fait : silence → champ vide / NOT_ASSESSED.
 */
export function composeStructuredSections(input: StructuredComposeInput): StructuredReportSections {
  const { extraction } = input;
  return {
    patientStatusNote: composePatientStatus(extraction),
    drivingRisk: inferDrivingRisk(extraction),
    diagnosisNote: composeDiagnosis(input.diagnosis),
    mainProblems: composeMainProblems(extraction),
    currentMedication: composeMedication(input.medications, extraction),
    interventionsProvided: composeCitedList(extraction.interventions),
    carePlan: composeCitedList(extraction.plan),
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
  const items: Array<{ assertion: ClinicalFact["assertion"]; confidence: ClinicalFact["confidence"]; hasEvidence: boolean }> =
    [];
  for (const domain of Object.keys(extraction.facts) as FactDomain[]) {
    const fact = extraction.facts[domain];
    if (!factMentionsDriving(fact)) continue;
    if (fact.temporality === "historical") continue;
    if (fact.source !== "transcript") continue;
    items.push({
      assertion: fact.assertion,
      confidence: fact.confidence,
      hasEvidence: Boolean(fact.evidence?.quote || fact.evidences.some((e) => e.temporality === "CURRENT")),
    });
  }
  for (const fact of extraction.medicationMentions) {
    if (!factMentionsDriving(fact)) continue;
    if (fact.temporality === "historical" || fact.source !== "transcript") continue;
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

function composePatientStatus(extraction: StoredExtraction) {
  const parts: string[] = [];
  for (const domain of ["mood", "affect", "anxiety", "functioning", "activity"] as const) {
    const fact = extraction.facts[domain];
    if (!isDocumentedCurrent(fact)) continue;
    const label = DOMAIN_HE[domain];
    const body = factLine(fact);
    if (!body) continue;
    parts.push(label ? `${label}: ${body}` : body);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

function composeDiagnosis(diagnosis: { primary: string | null; secondary: string | null }) {
  const lines: string[] = [];
  if (diagnosis.primary?.trim()) lines.push(diagnosis.primary.trim());
  if (diagnosis.secondary?.trim()) lines.push(diagnosis.secondary.trim());
  return lines.length > 0 ? lines.join("\n") : null;
}

function composeMainProblems(extraction: StoredExtraction) {
  const parts: string[] = [];

  const clinical = documentedLines(extraction, CLINICAL_DOMAINS);
  if (clinical.length > 0) parts.push(clinical.join("\n"));

  const exam = documentedLines(extraction, EXAM_DOMAINS);
  if (exam.length > 0) parts.push(exam.join("\n"));

  const risks = documentedRiskLines(extraction);
  if (risks.length > 0) parts.push(risks.join("\n"));

  const evolution = Object.entries(extraction.longitudinal)
    .map(([domain, value]) => {
      const label = DOMAIN_HE[domain as FactDomain];
      const he = EVOLUTION_HE[value ?? ""] ?? value;
      return label && he ? `${label}: ${he}` : null;
    })
    .filter(Boolean) as string[];
  if (evolution.length > 0) parts.push(`התפתחות:\n${evolution.join("\n")}`);

  if (extraction.changes.length > 0) {
    parts.push("יש שינוי מול ביקור מאומת קודם — לבדיקה.");
  }

  if (extraction.pointsToVerify.length > 0) {
    parts.push(`לאימות:\n${extraction.pointsToVerify.map((item) => `• ${item}`).join("\n")}`);
  }

  if (extraction.contradictions.length > 0) {
    parts.push(
      `סתירות לתיעוד:\n${extraction.contradictions.map((item) => `• ${item.summary}`).join("\n")}`,
    );
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function composeMedication(
  medications: Array<{ name: string; dose: string | null; frequency: string | null }>,
  extraction: StoredExtraction,
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

  const mentions = extraction.medicationMentions
    .filter((fact) => isDocumentedCurrent(fact))
    .map((fact) => factLine(fact))
    .filter(Boolean);
  if (mentions.length > 0 && medications.length === 0) {
    lines.push(...mentions.map((item) => String(item)));
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function composeCitedList(items: Array<{ text: string }>) {
  const lines = items.map((item) => item.text.trim()).filter(Boolean);
  return lines.length > 0 ? lines.map((line) => `• ${line}`).join("\n") : null;
}

function documentedLines(extraction: StoredExtraction, domains: readonly FactDomain[]) {
  const lines: string[] = [];
  for (const domain of domains) {
    const fact = extraction.facts[domain];
    if (!isDocumentedCurrent(fact)) continue;
    const label = DOMAIN_HE[domain];
    const body = factLine(fact);
    if (!body) continue;
    lines.push(label ? `${label}: ${body}` : body);
  }
  return lines;
}

function documentedRiskLines(extraction: StoredExtraction) {
  const lines: string[] = [];
  for (const domain of RISK_DOMAINS) {
    const fact = extraction.facts[domain];
    if (fact.assertion === "not_assessed" || fact.assertion === "not_reported") continue;
    if (fact.source !== "transcript") continue;
    if (fact.temporality === "historical" && fact.assertion !== "present") continue;
    const label = DOMAIN_HE[domain] ?? domain;
    if (fact.assertion === "explicitly_denied" && fact.evidence?.quote) {
      lines.push(`${label}: נשלל במפורש («${fact.evidence.quote}»)`);
      continue;
    }
    if (fact.assertion === "present") {
      const body = factLine(fact);
      if (body) lines.push(`${label}: ${body}`);
      continue;
    }
    if (fact.assertion === "uncertain") {
      lines.push(`${label}: לאימות`);
    }
  }
  return lines;
}

function isDocumentedCurrent(fact: ClinicalFact) {
  return (
    fact.assertion === "present" &&
    fact.temporality === "current_visit" &&
    fact.source === "transcript"
  );
}

function factLine(fact: ClinicalFact) {
  if (fact.evidence?.quote) return `נמסר: «${fact.evidence.quote}»`;
  return fact.value?.trim() || null;
}
