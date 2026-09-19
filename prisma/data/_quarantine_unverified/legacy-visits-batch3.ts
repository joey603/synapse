import type { DrivingRiskStatus, VisitType } from "@prisma/client";

import {
  composeLegacyHebrewReport,
  diagnosisFromPatient,
} from "../legacy-hebrew-batch1";

export type LegacyBatch3Visit = {
  importKey: string;
  /** Si true : n’update que si champs structurés vides (contrôle Lot 1). */
  controlOnly?: boolean;
  patient: {
    firstName: string;
    city: string;
    label: string;
    lastName?: string;
  };
  type: VisitType;
  when: string;
  timeKnown: boolean;
  patientStatusNote: string;
  drivingRisk: DrivingRiskStatus;
  mainProblems: string;
  currentMedication: string;
  interventionsProvided: string;
  carePlan: string;
};

export { composeLegacyHebrewReport, diagnosisFromPatient };

/**
 * Lot 3 — QUARANTINED (V1) — historique non intégralement vérifié à la source.
 * Reuben = orthographe DB pour « Reuven ».
 * Ne pas importer. Ne pas réactiver sans vérification source par source.
 */
export const LEGACY_VISITS_BATCH3: LegacyBatch3Visit[] = [
  {
    importKey: "legacy-sharon-rishon-2026-09-17-1100-in-person",
    patient: { firstName: "Sharon", city: "ראשון לציון", label: "Sharon — Rishon Lezion" },
    type: "IN_PERSON",
    when: "2026-09-17T11:00",
    timeKnown: true,
    patientStatusNote:
      "מצבה הנפשי של המטופלת יציב יחסית, לצד עלייה בחרדה על רקע תחילת שנת הלימודים וההבנה כי השנה לא תחזור לעבודתה כמורה.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ללא שינוי קליני משמעותי ביחס למעקבים הקודמים. המטופלת מתארת תחושה של נסיגה מסוימת שחוותה במהלך הקיץ, לצד עלייה מחודשת ברמת החרדה. החרדה מתגברת על רקע תחילת שנת הלימודים וההבנה כי השנה לא תשוב בפועל לעבודתה כמורה. המטופלת ממשיכה להיות מעורבת בפעילויות של ילדיה ובמסגרותיהם. היא נמצאת בתהליך הכנת תיק שיקום יחד עם העובדת הסוציאלית. המטופלת שוללת מחשבות אובדניות.",
    currentMedication:
      "המטופלת מדווחת על היענות לטיפול התרופתי. יש להסתמך על רשימת התרופות המעודכנת בתיק לצורך שמות התרופות והמינונים.",
    interventionsProvided:
      "בוצעה הקשבה פעילה, תמיכה וחיזוק חיובי. ניתן תיקוף לקושי הרגשי סביב תחילת שנת הלימודים ואובדן התפקיד המקצועי. ניתנה פסיכו־הדרכה והודגש כי תנודות ותקופות של עלייה בחרדה עשויות להופיע במהלך תהליך ההחלמה. נעשתה עבודה סביב המשמעות של אי־החזרה לעבודה והמשך בניית מקורות ערך ותפקוד נוספים.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח והחרדה. המשך עבודה עם העובדת הסוציאלית לקידום תיק השיקום. המשך חיזוק המעורבות המשפחתית והפעילויות הקשורות לילדים, לצד עידוד לבניית מסגרת תפקודית הדרגתית.",
  },
  {
    importKey: "legacy-justine-rishon-2026-09-16-in-person",
    patient: { firstName: "Justine", city: "ראשון לציון", label: "Justine — Rishon Lezion" },
    type: "IN_PERSON",
    when: "2026-09-16",
    timeKnown: false,
    patientStatusNote:
      "ניכר שיפור משמעותי במצבה הנפשי של המטופלת, עם שיפור במצב הרוח, באנרגיה, ביכולת ליהנות ובתפקוד.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ניכר שיפור משמעותי במצבה הנפשי בהשוואה לתקופה הקודמת. המטופלת מתארת שיפור במצב הרוח, באנרגיה וביכולת ליהנות מפעילויות. ניכרת גם הטבה בתפקוד וחזרה הדרגתית לפעילות. לצד השיפור יש להמשיך במעקב אחר יציבות מצב הרוח והתפקוד.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק המטופלת. לא תועד במסגרת הנתונים הזמינים שינוי תרופתי חדש בביקור הסיעודי.",
    interventionsProvided:
      "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה וחיזוק חיובי לנוכח השיפור במצב הרוח ובתפקוד.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, רמת האנרגיה, היכולת ליהנות, התפקוד והמשך החזרה ההדרגתית לפעילות.",
  },
  {
    importKey: "legacy-shahar-bitzaron-2026-09-15-1430-virtual",
    patient: { firstName: "Shahar", city: "ביצרון", label: "Shahar Golan — Bitzaron" },
    type: "VIRTUAL",
    when: "2026-09-15T14:30",
    timeKnown: true,
    patientStatusNote:
      "מצבה הנפשי יציב יחסית, לצד המשך תסמינים חרדתיים ודימוי עצמי נמוך.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ללא שינוי קליני משמעותי. המטופלת ממשיכה להתמודד עם תסמינים חרדתיים ועם דימוי עצמי נמוך. נמשכים קשיים במישור האישי, החברתי והזוגי. המטופלת שוללת מחשבות אובדניות.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק. לא תועד שינוי תרופתי במהלך השיחה.",
    interventionsProvided: "בוצעה הקשבה פעילה, תמיכה, חיזוק חיובי ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עבודה על חיזוק תחושת הערך העצמי, הפחתת החרדה, הגברת הפעילות והרחבת הקשרים החברתיים.",
  },
  {
    importKey: "legacy-shahar-bitzaron-2026-09-16-in-person",
    patient: { firstName: "Shahar", city: "ביצרון", label: "Shahar Golan — Bitzaron" },
    type: "IN_PERSON",
    when: "2026-09-16",
    timeKnown: false,
    patientStatusNote:
      "מצבה הנפשי יציב, ללא מחשבות אובדניות, לצד המשך תסמינים חרדתיים ודימוי עצמי נמוך משמעותית.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "הביקור התקיים בנוכחות בנה הצעיר של המטופלת. מצבה הנפשי יציב וללא מחשבות אובדניות. לצד זאת נמשכים תסמינים חרדתיים ודימוי עצמי נמוך משמעותית. במהלך השיחה נדונו היחסים והזוגיות עם בעלה לשעבר. המטופלת אינה עובדת וניכרת נטייה לצמצום פעילותה לתפקיד האימהי ולשהייה ממושכת בבית.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק. לא תועד שינוי תרופתי במהלך ביקור זה.",
    interventionsProvided:
      "בוצעה הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. נעשתה עבודה סביב חיזוק תחושת הערך העצמי והרחבת הזהות האישית מעבר לתפקיד האימהי. המטופלת עודדה לצאת מהבית, לפתח קשרים חברתיים ולהישאר פתוחה לאפשרות של קשר זוגי עתידי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עבודה על חיזוק תחושת הערך העצמי, הפחתת החרדה והרחבת הפעילות החברתית. עידוד ליציאה מהבית, יצירת קשרים חברתיים ופיתוח תחומי פעילות ועצמאות נוספים.",
  },
  {
    importKey: "legacy-reuven-ashdod-2026-09-15-1730-virtual",
    patient: { firstName: "Reuben", city: "אשדוד", label: "Reuven (Reuben) — Ashdod" },
    type: "VIRTUAL",
    when: "2026-09-15T17:30",
    timeKnown: true,
    patientStatusNote: "מצב הרוח במגמת התייצבות והמטופל ממשיך בתפקוד תעסוקתי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ללא שינוי קליני משמעותי. המטופל ממשיך לעבוד כמדריך במסגרת המתמחה בטיפול באנשים המתמודדים עם הפרעות נפשיות והתמכרויות. ניכרת שמירה על תפקוד תעסוקתי. המטופל שולל מחשבות אובדניות.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק המטופל. לא תועד שינוי תרופתי בשיחה זו.",
    interventionsProvided: "בוצעה הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך חיזוק התפקוד התעסוקתי ומעקב אחר מצב הרוח והתפקוד.",
  },
  {
    importKey: "legacy-reuven-ashdod-2026-09-16-1730-in-person",
    patient: { firstName: "Reuben", city: "אשדוד", label: "Reuven (Reuben) — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-16T17:30",
    timeKnown: true,
    patientStatusNote:
      "מצב הרוח משביע רצון ובמגמת התייצבות. ללא שינוי קליני משמעותי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ללא שינוי קליני משמעותי. הביקור התקיים בנוכחות בנו של המטופל. במהלך הביקור המטופל עסק בסידור קופסאות וכלי עבודה הקשורים לפעילות הקייטרינג. ניכרת שמירה על פעילות ותפקוד. מצב הרוח משביע רצון ובמגמת התייצבות. המטופל שולל מחשבות אובדניות ומדווח על היענות לטיפול התרופתי.",
    currentMedication:
      "המטופל מדווח על היענות לטיפול התרופתי. יש להסתמך על רשימת התרופות והמינונים המעודכנת בתיק.",
    interventionsProvided:
      "בוצעה הערכה קלינית, הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך חיזוק הפעילות והתפקוד, שמירה על היענות לטיפול התרופתי ומעקב אחר מצב הרוח.",
  },
  // Contrôle Ruth Lot 1 — ne pas recréer
  {
    importKey: "legacy-2026-09-16-ruth-inperson",
    controlOnly: true,
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod (contrôle Lot 1)" },
    type: "IN_PERSON",
    when: "2026-09-16T16:00",
    timeKnown: true,
    patientStatusNote: "שיפור קליני חלקי לצד המשך תסמינים דיכאוניים משמעותיים.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "לצד שיפור חלקי נמשכת תמונה דיכאונית משמעותית. קיימות הפרעות שינה משמעותיות: המטופלת נרדמת בסביבות 02:00–03:00, מתעוררת בשעה 08:00 לצורך הטיפול בילדים ולאחר מכן חוזרת לישון עד 12:00–13:00 לערך. הברית הטיפולית נותרת חלקית. המטופלת שוללת מחשבות אובדניות. הביקור התקיים בנוכחות הבעל.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק. לא להסיק שהטיפול לא השתנה רק משום שלא נידון מחדש בביקור זה.",
    interventionsProvided:
      "ניתנה פסיכו־הדרכה מקיפה בנושא חשיבות השינה וההיענות לטיפול התרופתי. בוצעה הקשבה פעילה וכן שיחה עם הבעל בנוגע למצבה של המטופלת.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. עבודה על הסדרת השינה ושמירה על היענות לטיפול התרופתי. המשך מעקב אחר התמונה הדיכאונית ועדכון תוכנית הטיפול בהתאם להערכה הפסיכיאטרית.",
  },
  {
    importKey: "legacy-sarah-ashdod-2026-09-15-1530-virtual",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "VIRTUAL",
    when: "2026-09-15T15:30",
    timeKnown: true,
    patientStatusNote:
      "ניכר שיפור במצבה הכללי והנפשי של המטופלת. מצב הרוח במגמת התייצבות וניכרת עלייה בתפקוד.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת מדווחת על שיפור במצבה הכללי והנפשי. במהלך היום החליפה עמיתה בעבודה בתפקיד אדמיניסטרטיבי־רפואי. ניכרת עלייה בתפקוד וביכולת להשתלב בפעילות תעסוקתית. מצב הרוח במגמת התייצבות. המטופלת מדווחת על היענות לטיפול התרופתי. תואם ביקור בית פרונטלי ליום המחרת.",
    currentMedication:
      "המטופלת מדווחת על היענות לטיפול התרופתי. יש להסתמך על רשימת התרופות והמינונים המעודכנת בתיק.",
    interventionsProvided:
      "בוצעה הערכה קלינית מרחוק, הקשבה פעילה, תמיכה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. ביקור בית פרונטלי למחרת. המשך עידוד לחזרה הדרגתית לתפקוד תעסוקתי ומעקב אחר מצב הרוח וההיענות לטיפול.",
  },
  {
    importKey: "legacy-sarah-ashdod-2026-09-16-1900-in-person",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-16T19:00",
    timeKnown: true,
    patientStatusNote:
      "ניכר שיפור קליני משמעותי במצבה הנפשי והתפקודי של המטופלת.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת עבדה גם היום כמחליפה של עמיתה במקום עבודתה ביבנה. הביקור התקיים לאחר חזרתה מהעבודה ובנוכחות אמה. ניכר שיפור משמעותי במצבה הקליני, במצב הרוח ובתפקוד. במהלך השיחה עלה נושא העלייה במשקל, אשר בשלב זה מתוארת כמתונה.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק המטופלת. המטופלת מדווחת על היענות לטיפול.",
    interventionsProvided:
      "בוצעה הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. ניתנה התייחסות לעלייה המתונה במשקל ולחשיבות המשך המעקב, תוך חיזוק ההתקדמות התפקודית והחזרה לפעילות תעסוקתית.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך חיזוק החזרה לתפקוד ולעבודה, מעקב אחר מצב הרוח וההיענות לטיפול וכן מעקב אחר השינויים במשקל.",
  },
  {
    importKey: "legacy-sharon-yehoshua-levy-ashdod-2026-09-15-in-person",
    patient: {
      firstName: "Sharon",
      lastName: "Lévy",
      city: "אשדוד",
      label: "Sharon Yehoshua Lévy — Ashdod",
    },
    type: "IN_PERSON",
    when: "2026-09-15",
    timeKnown: false,
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
];

/** Aucun patient hors cohort 40 — pas de brouillon pour patients absents. */
export const LEGACY_BATCH3_MISSING_PATIENTS: Array<{
  importKey: string;
  label: string;
  reason: string;
}> = [];
