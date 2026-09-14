import { NOT_ASSESSED_HE } from "@/lib/clinical/forbidden-phrases";
import type { ClinicalFact, FactDomain, StoredExtraction } from "@/lib/clinical/types";
import { CLINICAL_DOMAINS, EXAM_DOMAINS, RISK_DOMAINS } from "@/lib/clinical/types";
import { templateKeyFor } from "@/lib/clinical/templates";
import type { VisitType } from "@prisma/client";

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
  agitation: "אי-שקט",
  retardation: "האטה",
  insight: "תובנה",
  judgment: "שיפוט",
  behavior: "התנהגות",
  adherence: "היענות",
};

const RISK_HE: Record<(typeof RISK_DOMAINS)[number], string> = {
  suicidality: "מחשבות אובדניות",
  suicideIntent: "כוונה אובדנית",
  suicidePlan: "תכנית אובדנית",
  recentSuicidalBehavior: "התנהגות אובדנית לאחרונה",
  selfHarm: "פגיעה עצמית",
  psychosis: "פסיכוזה",
  aggression: "אלימות כלפי אחר",
  impulsivity: "אימפולסיביות",
  dangerousness: "מסוכנות",
  substanceUse: "שימוש בחומרים",
  sideEffects: "תופעות לוואי",
};

const VISIT_HE: Record<VisitType, string> = {
  IN_PERSON: "ביקור בית פרונטלי",
  VIRTUAL: "ביקור וירטואלי",
  PHONE: "שיחת טלפון",
  ADMISSION: "קבלה",
  ASSESSMENT: "הערכה",
  FAMILY_CONTACT: "קשר עם המשפחה",
  OTHER: "מפגש",
};

export function composeReport(input: {
  extraction: StoredExtraction;
  visitType: VisitType;
  occurredAt: Date;
  patientName: string;
}) {
  const key = templateKeyFor(input.visitType);
  const blocks: string[] = [];
  const date = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(input.occurredAt);

  blocks.push(block(titleFor(key), `בוצע ${VISIT_HE[input.visitType]} בתאריך ${date}.`));

  const clinical = sentencesFor(input.extraction, CLINICAL_DOMAINS);
  if (clinical.length > 0) blocks.push(block("מצב קליני", clinical.join(" ")));

  const exam = sentencesFor(input.extraction, EXAM_DOMAINS);
  if (exam.length > 0 && key !== "short") blocks.push(block("בדיקה פסיכיאטרית", exam.join(" ")));

  if (input.extraction.changes.length > 0) {
    blocks.push(block("שינוי מול ביקור מאומת קודם", "יש פער מול ביקור מאומת קודם. לבדוק, לא כממצא של היום בלבד."));
  }

  const meds = input.extraction.medicationMentions
    .filter((fact) => fact.assertion === "present" && fact.temporality === "current_visit" && fact.source === "transcript")
    .map((fact) => sentence(fact))
    .filter(Boolean);
  if (meds.length > 0 && key !== "short") blocks.push(block("טיפול", meds.join(" ")));

  blocks.push(block("הערכת מסוכנות", riskSentences(input.extraction).join(" ")));

  return blocks.join("\n\n");
}

function titleFor(key: string) {
  if (key === "remote") return "פרטי השיחה";
  if (key === "admission") return "פרטי הקבלה";
  return "פרטי הביקור";
}

function sentencesFor(extraction: StoredExtraction, domains: readonly FactDomain[]) {
  const sentences: string[] = [];
  for (const domain of domains) {
    const fact = extraction.facts[domain];
    if (!isCurrentPresent(fact)) continue;
    const label = DOMAIN_HE[domain];
    const body = sentence(fact);
    if (!body) continue;
    sentences.push(label ? `${label}: ${body}` : body);
  }
  return sentences;
}

function riskSentences(extraction: StoredExtraction) {
  return RISK_DOMAINS.map((domain) => {
    const fact = extraction.facts[domain];
    return `${RISK_HE[domain]}: ${riskPhrase(fact)}`;
  });
}

function riskPhrase(fact: ClinicalFact) {
  if (fact.assertion === "explicitly_denied" && fact.evidence?.quote && fact.source === "transcript") {
    return `נשלל במפורש במפגש זה. נמסר: «${fact.evidence.quote}»`;
  }
  if (fact.assertion === "present" && fact.evidence?.quote && fact.source === "transcript") {
    return `דווח במפגש זה. נמסר: «${fact.evidence.quote}»`;
  }
  if (fact.assertion === "uncertain") return "לאימות. לא נרשם כממצא.";
  if (fact.assertion === "not_reported") return "הנושא עלה, ללא נתון שניתן לתעד.";
  return NOT_ASSESSED_HE;
}

function sentence(fact: ClinicalFact) {
  if (fact.evidence?.quote) return `נמסר: «${fact.evidence.quote}»`;
  return fact.value;
}

function isCurrentPresent(fact: ClinicalFact) {
  return fact.assertion === "present" && fact.temporality === "current_visit" && fact.source === "transcript";
}

function block(title: string, body: string) {
  return `${title}\n${body.replace(/\n+/g, " ").trim()}`;
}
