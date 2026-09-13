import { NOT_ASSESSED_HE } from "@/lib/clinical/forbidden-phrases";
import type { ClinicalFact, FactDomain, StoredExtraction } from "@/lib/clinical/types";
import { RISK_DOMAINS } from "@/lib/clinical/types";
import { templateKeyFor } from "@/lib/clinical/templates";
import type { VisitType } from "@prisma/client";

const DOMAIN_HE: Partial<Record<FactDomain, string>> = {
  mood: "מצב רוח",
  sleep: "שינה",
  appetite: "תיאבון",
  anxiety: "חרדה",
  adherence: "היענות",
  family: "משפחה",
  functioning: "תפקוד",
};

const RISK_HE: Record<(typeof RISK_DOMAINS)[number], string> = {
  suicidality: "אובדנות",
  psychosis: "פסיכוזה",
  aggression: "אלימות כלפי אחר",
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

  const clinical = currentSentences(input.extraction);
  if (clinical.length > 0) blocks.push(block("מצב קליני", clinical.join(" ")));

  if (input.extraction.changes.length > 0) {
    blocks.push(block("שינוי מול ביקור מאומת קודם", "יש פער מול ביקור מאומת קודם. לבדוק, לא כממצא של היום בלבד."));
  }

  const meds = input.extraction.medicationMentions
    .filter((fact) => fact.assertion === "present" && fact.temporality === "current_visit")
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

function currentSentences(extraction: StoredExtraction) {
  const sentences: string[] = [];
  for (const [domain, fact] of Object.entries(extraction.facts) as Array<[FactDomain, ClinicalFact]>) {
    if (RISK_DOMAINS.includes(domain as (typeof RISK_DOMAINS)[number])) continue;
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
  if (fact.assertion === "explicitly_denied" && fact.evidence?.quote) {
    return `נמסר במפורש: «${fact.evidence.quote}»`;
  }
  if (fact.assertion === "present" && fact.evidence?.quote) {
    return `לאימות. נמסר: «${fact.evidence.quote}»`;
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
