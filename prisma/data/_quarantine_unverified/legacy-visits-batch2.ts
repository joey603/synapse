import type { DrivingRiskStatus, VisitType } from "@prisma/client";

import {
  composeLegacyHebrewReport,
  diagnosisFromPatient,
} from "../legacy-hebrew-batch1";

export type LegacyBatch2Visit = {
  importKey: string;
  patient: { firstName: string; city: string; label: string };
  type: VisitType;
  /** Jerusalem `YYYY-MM-DDTHH:mm` si heure connue, sinon `YYYY-MM-DD`. */
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
 * Lot 2 — historique clinique hébreu (VALIDATED).
 * Textes fournis tels quels — aucune invention.
 */
export const LEGACY_VISITS_BATCH2: LegacyBatch2Visit[] = [
  {
    importKey: "legacy-neiman-2026-09-09-1900-virtual",
    patient: { firstName: "Neiman", city: "גני הדר", label: "Neiman — Ganei Hadar" },
    type: "VIRTUAL",
    when: "2026-09-09T19:00",
    timeKnown: true,
    patientStatusNote:
      "מצב הרוח במגמת התייצבות הדרגתית. המטופלת אינה מדווחת על תופעות לוואי בעקבות העלאת מינון הליתיום.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת נמצאת במעקב במסגרת אשפוז בית פסיכיאטרי על רקע תסמינים חרדתיים־דיכאוניים ותנודות במצב הרוח. במהלך השיחה מדווחת כי אינה חווה תופעות לוואי בעקבות העלאת מינון הליתיום. מצב הרוח במגמת התייצבות הדרגתית. לא תועד במהלך שיחה זו שינוי קליני משמעותי נוסף.",
    currentMedication:
      "ליתיום בהתאם לטיפול המעודכן בתיק המטופלת. במהלך השיחה המטופלת אינה מדווחת על תופעות לוואי בעקבות העלאת המינון.",
    interventionsProvided:
      "בוצעה הקשבה פעילה, תמיכה, חיזוק חיובי ופסיכו־הדרכה בנוגע לטיפול התרופתי ולחשיבות המעקב אחר יעילות הטיפול ותופעות לוואי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, תנודות במצב הרוח, תגובה לטיפול בליתיום והופעת תופעות לוואי. המשך חיזוק ההיענות לטיפול ולמעקב הרפואי.",
  },
  {
    importKey: "legacy-ayelet-2026-09-10-virtual",
    patient: { firstName: "Ayelet", city: "רמלה", label: "Ayelet — Ramle" },
    type: "VIRTUAL",
    when: "2026-09-10",
    timeKnown: false,
    patientStatusNote:
      "ניכר שיפור מסוים ברמת החרדה, לצד עייפות מתמשכת והפרעה בדפוסי השינה והתפקוד.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת מדווחת על ירידה מסוימת ברמת החרדה, אך ממשיכה לסבול מעייפות משמעותית ומשינה ממושכת ומאוחרת. נמשכים קשיים בתפקוד ובהנעה לפעילות. ההערכה בוצעה מרחוק ולכן קיימת מגבלה בהתרשמות הקלינית המלאה. במהלך השיחה המטופלת שוללת מחשבות אובדניות ולא עולה התרשמות למסוכנות מיידית.",
    currentMedication:
      "המטופלת מדווחת על טיפול ב־Lustral. יש להסתמך על רשימת הטיפול התרופתי המעודכנת בתיק לצורך המינון המדויק.",
    interventionsProvided:
      "בוצעה הערכה קלינית מרחוק, הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. ניתן חיזוק להמשך פעילות הדרגתית ולהפחתת הימנעות.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, רמת החרדה, דפוסי השינה, רמת האנרגיה והתפקוד. המשך עידוד לפעילות הדרגתית ולשיפור ההתארגנות היומיומית.",
  },
  {
    importKey: "legacy-ayelet-2026-09-15-in-person",
    patient: { firstName: "Ayelet", city: "רמלה", label: "Ayelet — Ramle" },
    type: "IN_PERSON",
    when: "2026-09-15",
    timeKnown: false,
    patientStatusNote:
      "ניכר שיפור קל במצב הרוח, ברמת החרדה ובתסמינים האובססיביים, לצד המשך פגיעה משמעותית באנרגיה ובתפקוד.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ניכר שיפור קל במצב הרוח, ברמת החרדה ובתסמינים האובססיביים. עם זאת, המטופלת ממשיכה לדווח על ירידה באנרגיה, דחיינות וקושי משמעותי בהנעה לפעילות. טרם הצליחה לחזור ללימודים ומתקשה להתארגן ולסדר את הבית. המטופלת שוללת מחשבות אובדניות, כוונה או תוכנית אובדנית וכן התנהגות של פגיעה עצמית. במהלך הביקור לא עלו תכנים פסיכוטיים ולא התרשמתי ממסוכנות מיידית.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק המטופלת. לא לתעד שינוי תרופתי אם לא תועד במפורש בביקור.",
    interventionsProvided:
      "בוצעה הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. נעשה שימוש בעקרונות CBT, לרבות עבודה סביב הימנעות, דחיינות והנעה לפעילות, וכן עקרונות של ERP ו־Behavioral Activation בהתאם לתסמינים האובססיביים והירידה בתפקוד.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עבודה הדרגתית על הפחתת הימנעות ודחיינות, הגברת פעילות, שיפור ההתארגנות בבית וחזרה הדרגתית לתפקוד וללימודים. המשך מעקב אחר מצב הרוח, החרדה, התסמינים האובססיביים והמסוכנות.",
  },
  {
    importKey: "legacy-yael-lod-2026-09-09-virtual",
    patient: { firstName: "Yael", city: "לוד", label: "Yael — Lod" },
    type: "VIRTUAL",
    when: "2026-09-09",
    timeKnown: false,
    patientStatusNote:
      "ניכר שיפור הדרגתי במצב הנפשי ובתפקוד, עם עלייה באנרגיה וביוזמה.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת מדווחת על שיפור הדרגתי בתפקוד. לדבריה יצאה מהבית מספר פעמים, לרבות לצורך הגעה לבית המרקחת, והצליחה לבצע פעולות בבית כגון שטיפת הרצפה. מתארת עלייה באנרגיה ובפתיחות לפעילות. לדבריה גם אביה ובן זוגה מבחינים בשיפור במצבה. המטופלת מציינת כי הטיפול מסייע לה. במהלך השיחה לא עלו באופן ספונטני תכנים פסיכוטיים או אובדניים.",
    currentMedication:
      "יש להסתמך על הטיפול התרופתי המעודכן בתיק המטופלת. המטופלת מדווחת כי הטיפול מסייע לה.",
    interventionsProvided:
      "בוצעה הערכה קלינית מרחוק, הקשבה פעילה וחיזוק חיובי לנוכח העלייה בפעילות ובתפקוד.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עידוד ליציאה מהבית, להגברת הפעילות ולביצוע מטלות יומיומיות באופן הדרגתי. המשך מעקב אחר מצב הרוח, רמת האנרגיה והתפקוד.",
  },
  {
    importKey: "legacy-yael-lod-2026-09-11-in-person",
    patient: { firstName: "Yael", city: "לוד", label: "Yael — Lod" },
    type: "IN_PERSON",
    when: "2026-09-11",
    timeKnown: false,
    patientStatusNote:
      "נמשך השיפור ההדרגתי במצב הנפשי ובתפקוד. מצב הרוח יציב יותר וניכרת עלייה בפעילות.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת מתארת המשך שיפור במצבה. איכות השינה השתפרה, אם כי משך השינה עדיין ממושך. לדבריה מתעוררת כיום בסביבות 12:00–13:00, לעומת 14:00–15:00 בעבר. מדווחת על יותר יציאות מהבית ועל ביצוע מטלות יומיומיות. השתתפה בנסיעה משפחתית לצפון ומתכוננת לאירוע משפחתי המתוכנן בין 27–29 בחודש. המטופלת שוללת מחשבות אובדניות.",
    currentMedication:
      "Viepax בהתאם לטיפול המעודכן בתיק. בנוסף מתועד שימוש בקנאביס בכמות של כ־60 גרם בחודש.",
    interventionsProvided:
      "בוצעה הערכה קלינית, הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. ניתן חיזוק להתקדמות בתפקוד, ליציאה מהבית ולהגברת הפעילות.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עידוד לפעילות, יציאה מהבית ושיפור הדרגתי של סדר היום. המשך מעקב אחר מצב הרוח, דפוסי השינה, התפקוד והשימוש בקנאביס.",
  },
];
