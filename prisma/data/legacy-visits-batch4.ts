import type { DrivingRiskStatus, VisitType } from "@prisma/client";

import {
  composeLegacyHebrewReport,
  diagnosisFromPatient,
} from "./legacy-hebrew-batch1";

export type LegacyBatch4Visit = {
  importKey: string;
  mode: "CREATE" | "CONTROL";
  patient: {
    firstName: string;
    city: string;
    label: string;
    lastName?: string;
  };
  type: VisitType;
  when: string;
  timeKnown: boolean;
  /** Présent pour CREATE, et pour CONTROL uniquement si backfill structurés autorisé. */
  seed?: {
    patientStatusNote: string;
    drivingRisk: DrivingRiskStatus;
    mainProblems: string;
    currentMedication: string;
    interventionsProvided: string;
    carePlan: string;
  };
};

export { composeLegacyHebrewReport, diagnosisFromPatient };

/** Homonymes non résolus — SKIP obligatoire. */
export const LEGACY_BATCH4_AMBIGUOUS = [
  {
    importKey: "legacy-dana-rishon-2026-09-14-1500-in-person",
    label: "Dana — Rishon Lezion",
    code: "AMBIGUOUS_PATIENT_MATCH" as const,
    reason:
      "Deux dossiers distincts : Dana Saffran et Dana (sans nom) à ראשון לציון. Aucun diagnostic, visite, médicament ni contact en DB pour désambiguïser. Ne pas fusionner.",
  },
];

/**
 * Lot 4 — nouvelles visites + contrôles d’idempotence.
 * Dana : non importée (AMBIGUOUS_PATIENT_MATCH).
 */
export const LEGACY_VISITS_BATCH4: LegacyBatch4Visit[] = [
  {
    importKey: "legacy-yael-ashdod-2026-09-15-in-person",
    mode: "CREATE",
    patient: { firstName: "Yael", city: "אשדוד", label: "Yael — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-15",
    timeKnown: false,
    seed: {
      patientStatusNote:
        "נמשכת תמונה חרדתית־דיכאונית עם פגיעה בתפקוד, על רקע גורמי דחק פסיכו־סוציאליים משמעותיים.",
      drivingRisk: "NOT_ASSESSED",
      mainProblems:
        "המטופלת נמצאת במסגרת אשפוז בית לאחר החמרה במצבה הנפשי והתפקודי על רקע גורמי דחק משמעותיים, לרבות הליך גירושין וקשיים כלכליים. מתוארים מצב רוח ירוד, ירידה בתפקוד, ירידה בתיאבון ובמשקל וכן תסמיני חרדה הכוללים דפיקות לב, הזעה ואי־שקט פנימי. במסגרת ההערכה המתועדת המטופלת שוללת מחשבות אובדניות וכוונה לפגיעה עצמית.",
      currentMedication:
        "יש להסתמך על רשימת הטיפול התרופתי המעודכנת בתיק המטופלת. אין ליצור או לשנות טיפול תרופתי על בסיס יבוא היסטורי זה.",
      interventionsProvided:
        "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה, חיזוק חיובי ופסיכו־הדרכה בהתייחס להתמודדות עם החרדה, הירידה במצב הרוח והפגיעה בתפקוד.",
      carePlan:
        "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, רמת החרדה, התפקוד, השינה, התיאבון והמשקל. המשך הערכת מסוכנות ומעקב אחר השפעת גורמי הדחק הפסיכו־סוציאליים.",
    },
  },
  {
    importKey: "legacy-neiman-ganei-hadar-2026-09-16-in-person",
    mode: "CREATE",
    patient: { firstName: "Neiman", city: "גני הדר", label: "Neiman — Ganei Hadar" },
    type: "IN_PERSON",
    when: "2026-09-16",
    timeKnown: false,
    seed: {
      patientStatusNote:
        "נמשך שיפור במצב הרוח, ללא תנודתיות משמעותית כעת, לצד המשך צורך במעקב אחר מחשבות אובדניות חולפות.",
      drivingRisk: "NOT_ASSESSED",
      mainProblems:
        "ניכר שיפור במצב הרוח ובתפקוד. המטופלת מתארת ירידה משמעותית בתנודתיות במצב הרוח וכן ירידה באפיזודות בעלות מאפיינים היפומאניים. מדווחת כי קיימים לעיתים רגעים של עצב ומחשבות אובדניות, אך לדבריה מחשבות אלו חולפות במהירות וכעת אינה חוששת שתפגע בעצמה. חל שיפור בתפקוד והיא אינה נזקקת עוד לימי מחלה בשל מצב רוח ירוד.",
      currentMedication:
        "בהערכה הרפואית המתועדת באותו יום מופיע טיפול בליתיום 600 מ\"ג, ציפרלקס 20 מ\"ג וולבוטרין 150 מ\"ג. מקור המידע: תיעוד רפואי (OTHER_CLINICIAN). לא בוצע עדכון אוטומטי של רשימת התרופות בתיק המטופלת.",
      interventionsProvided:
        "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה וחיזוק חיובי לנוכח השיפור במצב הרוח ובתפקוד. נמשך מעקב אחר יעילות הטיפול, תנודות במצב הרוח ומחשבות אובדניות חולפות.",
      carePlan:
        "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, הופעת מאפיינים היפומאניים, תפקוד, תגובה לטיפול ותופעות לוואי. יש להמשיך בהערכת מחשבות אובדניות ומסוכנות בכל מפגש בהתאם למצב הקליני.",
    },
  },

  // Contrôle Lot 3 — backfill structurés autorisé si finalReport seul
  {
    importKey: "legacy-sharon-yehoshua-levy-ashdod-2026-09-15-in-person",
    mode: "CONTROL",
    patient: {
      firstName: "Sharon",
      lastName: "Lévy",
      city: "אשדוד",
      label: "Sharon Yehoshua Lévy — Ashdod (contrôle Lot 3)",
    },
    type: "IN_PERSON",
    when: "2026-09-15",
    timeKnown: false,
    seed: {
      patientStatusNote:
        "ניכר שיפור מסוים במצב הרוח, לצד המשך ירידה משמעותית בתפקוד.",
      drivingRisk: "NOT_ASSESSED",
      mainProblems:
        "המטופל נמצא במסגרת אשפוז בית על רקע תמונה חרדתית־דיכאונית שאינה מגיעה לרמה מאג'ורית, לצד מאפייני אישיות המתועדים בתיק. מדווח על שיפור מסוים במצב הרוח, אך ממשיך לתאר ירידה תפקודית משמעותית וקושי לחזור לעבודה. נדרש המשך מעקב אחר התפקוד, מצב הרוח ורמת החרדה.",
      currentMedication:
        "יש להסתמך על הטיפול התרופתי המעודכן בתיק. לא תועד במסגרת המידע הזמין שינוי תרופתי חדש.",
      interventionsProvided:
        "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה, חיזוק חיובי ופסיכו־הדרכה.",
      carePlan:
        "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, החרדה והתפקוד, לצד עידוד לחזרה הדרגתית לפעילות ולתפקוד תעסוקתי.",
    },
  },

  // Contrôles verify-only (pas de backfill — seeds Lot 1/3 déjà en DB)
  {
    importKey: "legacy-2026-09-01-alicia-inperson",
    mode: "CONTROL",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod (contrôle Lot 1)" },
    type: "IN_PERSON",
    when: "2026-09-01",
    timeKnown: false,
  },
  {
    importKey: "legacy-2026-09-09-alicia-virtual",
    mode: "CONTROL",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod (contrôle Lot 1)" },
    type: "VIRTUAL",
    when: "2026-09-09",
    timeKnown: false,
  },
  {
    importKey: "legacy-2026-09-15-alicia-inperson",
    mode: "CONTROL",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod (contrôle Lot 1)" },
    type: "IN_PERSON",
    when: "2026-09-15",
    timeKnown: false,
  },
  {
    importKey: "legacy-reuven-ashdod-2026-09-15-1730-virtual",
    mode: "CONTROL",
    patient: {
      firstName: "Reuben",
      city: "אשדוד",
      label: "Reuven (Reuben) — Ashdod (contrôle Lot 3)",
    },
    type: "VIRTUAL",
    when: "2026-09-15T17:30",
    timeKnown: true,
  },
  {
    importKey: "legacy-reuven-ashdod-2026-09-16-1730-in-person",
    mode: "CONTROL",
    patient: {
      firstName: "Reuben",
      city: "אשדוד",
      label: "Reuven (Reuben) — Ashdod (contrôle Lot 3)",
    },
    type: "IN_PERSON",
    when: "2026-09-16T17:30",
    timeKnown: true,
  },
  {
    importKey: "legacy-shahar-bitzaron-2026-09-15-1430-virtual",
    mode: "CONTROL",
    patient: {
      firstName: "Shahar",
      city: "ביצרון",
      label: "Shahar Golan — Bitzaron (contrôle Lot 3)",
    },
    type: "VIRTUAL",
    when: "2026-09-15T14:30",
    timeKnown: true,
  },
  {
    importKey: "legacy-shahar-bitzaron-2026-09-16-in-person",
    mode: "CONTROL",
    patient: {
      firstName: "Shahar",
      city: "ביצרון",
      label: "Shahar Golan — Bitzaron (contrôle Lot 3)",
    },
    type: "IN_PERSON",
    when: "2026-09-16",
    timeKnown: false,
  },
];
