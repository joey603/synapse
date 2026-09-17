import type { DrivingRiskStatus, VisitType } from "@prisma/client";

export type LegacyHebrewUpdate = {
  importKey: string;
  patient: { firstName: string; city: string; label: string };
  type: VisitType;
  patientStatusNote: string;
  drivingRisk: DrivingRiskStatus;
  mainProblems: string;
  currentMedication: string;
  interventionsProvided: string;
  carePlan: string;
};

/**
 * Mise à jour hébraïque Lot 1 — textes historiques fournis tels quels.
 * diagnosisNote = dossier Patient (rempli au runtime, jamais inventé ici).
 */
export const LEGACY_HEBREW_BATCH1: LegacyHebrewUpdate[] = [
  {
    importKey: "legacy-2026-09-01-alicia-inperson",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod" },
    type: "IN_PERSON",
    patientStatusNote:
      "ניכר שיפור קליני משמעותי. מצב הרוח יציב והמטופלת מגלה יכולת לתכנון עתידי, לרבות אפשרות לחזרה לעבודה.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ניכר שיפור משמעותי במצבה הקליני של המטופלת. במהלך הביקור לא עלו תכנים דלוזיונליים. המטופלת שוללת מחשבות אובדניות. מתכננת אפשרות לחזרה לעבודה בעוד כחודש. נדרש המשך מעקב אחר מצבה הנפשי והתגובה לטיפול התרופתי.",
    currentMedication:
      'קלוזאפין 250 מ"ג בהתאם למידע המתועד בביקור. המטופלת מדווחת על סבילות טובה לטיפול.',
    interventionsProvided: "בוצעה הערכה קלינית, הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית, מעקב אחר המצב הנפשי והסבילות לטיפול התרופתי. המשך עידוד לחזרה הדרגתית לתפקוד ולפעילות תעסוקתית.",
  },
  {
    importKey: "legacy-2026-09-09-alicia-virtual",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod" },
    type: "VIRTUAL",
    patientStatusNote: "נמשך השיפור במצבה הקליני של המטופלת. ממשיכה בתפקוד ובפעילות תעסוקתית.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "נמשך השיפור במצבה הקליני. השיחה התקיימה בהשתתפות האם. המטופלת ממשיכה בפעילות תעסוקתית. מתוכננת הערכה רפואית בבית החולים אסף הרופא בתאריך 22/09.",
    currentMedication:
      "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך שיחה זו. יש להסתמך על הטיפול המעודכן בתיק המטופלת.",
    interventionsProvided: "בוצעה הקשבה פעילה, תמיכה ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית והמשך מעקב קליני. המשך בהתאם להערכה הרפואית המתוכננת ל־22/09.",
  },
  {
    importKey: "legacy-2026-09-15-alicia-inperson",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod" },
    type: "IN_PERSON",
    patientStatusNote: "מצב הרוח יציב ואף מרומם יחסית. המטופלת ממשיכה בתפקוד תעסוקתי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      'במהלך הביקור עלה קושי בחידוש מרשם לקלוזאפין. המטופלת מקבלת 250 מ"ג, אולם האם טרם קיבלה את המרשם המעודכן. המטופלת מבצעת בדיקת דם שבועית והאם מבקשת הבהרה לגבי הצורך במעקב זה. המטופלת ממשיכה לעבוד. צפויות בדיקות רפואיות נוספות בעקבות דיווח על סמנים גידוליים חיוביים. מצב הרוח יציב ואף מרומם יחסית.',
    currentMedication:
      'קלוזאפין 250 מ"ג בהתאם למידע המתועד. קיים קושי בחידוש המרשם ויש לוודא זמינות רציפה של הטיפול.',
    interventionsProvided:
      "בוצעה הערכה קלינית, הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. הוסבר לאם הצורך בהשגת המרשם בהקדם על מנת למנוע הפסקה ברצף הטיפול התרופתי.",
    carePlan:
      "יש לעדכן את הפסיכיאטר ולוודא חידוש המרשם לקלוזאפין בהקדם. המשך המעקב הביולוגי והבדיקות הרפואיות המתוכננות. המשך מעקב במסגרת אשפוז בית.",
  },

  {
    importKey: "legacy-2026-09-07-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    patientStatusNote: "מצב הרוח יציב יחסית, עם נוכחות של מרכיב חרדתי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופל מתכונן לחגי ראש השנה. במהלך השיחה עלו שאלות קיומיות, נושאים הקשורים לזהותו ולמקומו כאב. ניכרת נוכחות של מרכיב חרדתי. המטופל שולל מחשבות אובדניות.",
    currentMedication:
      "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך ביקור זה. יש להסתמך על הטיפול המעודכן בתיק.",
    interventionsProvided: "בוצעה הקשבה פעילה, תמיכה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עבודה סביב החרדה, תחושת הערך העצמי, התפקוד והמעורבות המשפחתית.",
  },
  {
    importKey: "legacy-2026-09-10-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    patientStatusNote: "מצב הרוח במגמת התייצבות, לצד עלייה בחרדה על רקע המצב המשפחתי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופל השתתף בוועדה בנושא סל שיקום. מתאר מצב משפחתי מלחיץ על רקע אשפוז אחותו בשל אי־ספיקת לב וצורך בעירוי של שתי מנות דם. מצב זה מעורר מחדש חרדה סביב נושאים של אובדן. למרות זאת, מצב הרוח במגמת התייצבות. המטופל שולל מחשבות אובדניות. ניכרת פתיחות חברתית, לרבות יציאה ומפגש חדש שעשוי להתפתח לקשר בין־אישי משמעותי.",
    currentMedication: "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך ביקור זה.",
    interventionsProvided: "בוצעה הקשבה פעילה, תמיכה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח והחרדה, לצד עידוד פתיחות חברתית וחיזוק גורמי ההגנה.",
  },
  {
    importKey: "legacy-2026-09-13-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    patientStatusNote: "ללא שינוי קליני משמעותי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופל בילה את חגי ראש השנה עם ילדיו. נמשכים קשיים ביחסים עם גרושתו. לצד זאת, המטופל ממשיך להיות מעורב ומושקע מאוד בקשר עם ילדיו. שולל מחשבות אובדניות.",
    currentMedication: "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך ביקור זה.",
    interventionsProvided: "בוצעה הקשבה פעילה, תמיכה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עבודה סביב היחסים המשפחתיים, תחושת הערך העצמי, העצמאות והתפקוד.",
  },
  {
    importKey: "legacy-2026-09-15-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    patientStatusNote: "ניכר שיפור במצבו הנפשי של המטופל.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "ניכר שיפור במצבו הנפשי של המטופל. המטופל מתאר קשר עם חברת ילדות שאותה פגש מחדש לאחרונה, קשר אשר לדבריו עשוי להתפתח לכיוון זוגי. קשר זה תורם לחיזוק תחושת הערך העצמי שלו. המטופל ממשיך להיות מעורב ומושקע מאוד בקשר עם ילדיו. בשלב זה טרם חזר לפעילות תעסוקתית. שולל מחשבות אובדניות.",
    currentMedication:
      "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך ביקור זה. יש להסתמך על הטיפול המעודכן בתיק המטופל.",
    interventionsProvided:
      "בוצעה שיחה טיפולית הכוללת הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה. ניתן חיזוק להתקדמות במישור החברתי והבין־אישי ולגורמים התורמים לשיפור תחושת הערך העצמי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עידוד ליצירת קשרים חברתיים, חיזוק תחושת הערך העצמי, קידום עצמאות וחזרה הדרגתית לפעילות ולתפקוד.",
  },

  {
    importKey: "legacy-2026-09-14-dor-virtual",
    patient: { firstName: "Dor", city: "נס ציונה", label: "Dor — Ness Ziona" },
    type: "VIRTUAL",
    patientStatusNote:
      "ללא שינוי קליני משמעותי. מדווח על שיפור במצבו הגופני לאחר מחלה דמוית הצטננות.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "לא נצפה שינוי משמעותי במצב הקליני. המטופל מדווח כי חל שיפור במצבו הגופני לאחר שהיה מצונן. ביקור בית קודם שתוכנן לא התקיים ולכן אין לתעד אותו כביקור שבוצע.",
    currentMedication: "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך שיחה זו.",
    interventionsProvided: "בוצע קשר קליני, הקשבה פעילה ותיאום המשך המעקב.",
    carePlan: "המשך מעקב במסגרת אשפוז בית ותיאום ביקור בית פרונטלי.",
  },
  {
    importKey: "legacy-2026-09-16-dor-inperson",
    patient: { firstName: "Dor", city: "נס ציונה", label: "Dor — Ness Ziona" },
    type: "IN_PERSON",
    patientStatusNote: "ניכר שיפור קליני ומצב הרוח יציב יותר.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "הביקור התקיים בבית אמו של המטופל. ניכר שיפור במצבו הקליני ומצב הרוח יציב יותר. המטופל מתלונן על כאבי גב. לדבריו החזיר חלק מחובותיו, הוציא דרכון לצורך אפשרות לנסיעה לחו\"ל והחל לחסוך כסף. ניכרת חזרה הדרגתית ליכולת תכנון והתארגנות אישית. שולל מחשבות אובדניות.",
    currentMedication: "לא בוצעה הערכה מחודשת של הטיפול התרופתי במהלך ביקור זה.",
    interventionsProvided: "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עידוד לשיפור התפקוד, ההתארגנות האישית והיכולת לתכנון עתידי. המשך מעקב אחר מצב הרוח.",
  },

  {
    importKey: "legacy-2026-09-02-jacky-inperson",
    patient: { firstName: "Jacky", city: "ראשון לציון", label: "Jacky — Rishon Lezion" },
    type: "IN_PERSON",
    patientStatusNote: "שיפור חלקי בתסמינים האובססיביים־רומינטיביים ובתדירות התנהגויות הבדיקה.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      'המטופל מתאר מחשבות רומינטיביות ותסמינים אובססיביים, עם ירידה בהתנהגויות הבדיקה. מדווח על תועלת מהטיפול באולנזפין, לצד עלייה בתיאבון, סדציה ותחושת חוסר יציבות. ברקע סוכרת המחייבת ערנות ומעקב מטבולי. בהיסטוריה הקרובה תועדו מחשבות אובדניות, לרבות מחשבה על נטילת Bondormin וכתיבת צוואה. מדובר במידע היסטורי ואין להציגו כמחשבות אובדניות נוכחיות ללא עדות מהביקור הנוכחי. קיימת אי־התאמה לגבי מינון האולנזפין: המטופל דיווח על 2.5 מ"ג בעוד שבמרשם מתועד 5 מ"ג. נדרש בירור.',
    currentMedication:
      'אולנזפין — קיימת אי־התאמה במינון: 2.5 מ"ג לפי דיווח המטופל לעומת 5 מ"ג לפי המרשם המתועד. אין לקבוע מינון עד לבירור מול הטיפול המעודכן בתיק.',
    interventionsProvided:
      "בוצעה הערכה קלינית, הערכת ומעקב מסוכנות, פסיכו־הדרכה ומעקב אחר סבילות לטיפול התרופתי.",
    carePlan:
      "יש לוודא את מינון האולנזפין מול הטיפול המעודכן בתיק. המשך מעקב אחר מסוכנות אובדנית. המשך מעקב אחר תופעות לוואי ומדדים מטבוליים, בפרט על רקע הסוכרת.",
  },
  {
    importKey: "legacy-2026-09-09-jacky-inperson",
    patient: { firstName: "Jacky", city: "ראשון לציון", label: "Jacky — Rishon Lezion" },
    type: "IN_PERSON",
    patientStatusNote: "שיפור חלקי בתסמינים האובססיביים עם ירידה בהתנהגויות הבדיקה.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "נמשכים תסמינים אובססיביים ורומינטיביים, עם ירידה בהתנהגויות הבדיקה. נדרש המשך מעקב אחר סבילות לאולנזפין בשל עלייה בתיאבון, סדציה ותחושת חוסר יציבות. ברקע מצב מטבולי המחייב ערנות. יש להמשיך בהערכת המסוכנות האובדנית לאור הנתונים ההיסטוריים. אי־ההתאמה במינון האולנזפין עדיין דורשת בירור.",
    currentMedication: "אולנזפין. המינון המדויק דורש אימות מול הטיפול המעודכן בתיק.",
    interventionsProvided:
      "בוצעה הערכה קלינית, מעקב אחר מסוכנות וסבילות לטיפול, הקשבה פעילה ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. אימות מינון האולנזפין והמשך מעקב קליני, אובדני ומטבולי.",
  },
  {
    importKey: "legacy-2026-09-15-jacky-virtual",
    patient: { firstName: "Jacky", city: "ראשון לציון", label: "Jacky — Rishon Lezion" },
    type: "VIRTUAL",
    patientStatusNote: "ללא שינוי קליני משמעותי.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "השיחה התקיימה לאחר שהמטופל חזר מבית הכנסת. ללא שינוי קליני משמעותי. במהלך השיחה המטופל אינו מבטא מחשבות אובדניות.",
    currentMedication: "הטיפול התרופתי לא הוערך מחדש במהלך שיחה זו.",
    interventionsProvided: "בוצעה הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה.",
    carePlan: "נקבע ביקור בית פרונטלי ליום המחרת. המשך מעקב קליני במסגרת אשפוז בית.",
  },

  {
    importKey: "legacy-2026-09-04-ruth-inperson",
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod" },
    type: "IN_PERSON",
    patientStatusNote: "תמונה דיכאונית משמעותית עם ירידה בתפקוד.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת מציגה מצב רוח ירוד, אנהדוניה, ירידה באנרגיה ובתפקוד, הפרעות שינה, ירידה בתיאבון, קשיי ריכוז ותחושת ייאוש. מהלך החשיבה מאורגן וללא עדות לתכנים פסיכוטיים במהלך ההערכה. המטופלת אינה מדווחת על כוונה אובדנית או תוקפנית.",
    currentMedication:
      'מתועד מעבר מ־Lustral/Sertraline ל־Viepax 75 מ"ג. שימוש ב־Clonex עם השפעה חלקית.',
    interventionsProvided: "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר המצב הדיכאוני, השינה, התפקוד, המסוכנות והתגובה והסבילות לטיפול התרופתי.",
  },
  {
    importKey: "legacy-2026-09-15-ruth-virtual",
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod" },
    type: "VIRTUAL",
    patientStatusNote: "נמשכת תמונה דיכאונית משמעותית עם פגיעה בתפקוד.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "נמשכים מצב רוח ירוד, אנהדוניה, ירידה באנרגיה ופגיעה בתפקוד. קיימות הפרעות שינה משמעותיות. הברית הטיפולית חלקית. מהלך החשיבה מאורגן וללא תסמינים פסיכוטיים מדווחים. המטופלת אינה מדווחת על כוונה אובדנית או תוקפנית.",
    currentMedication:
      'Viepax 75 מ"ג ליום ו־Clonex 0.5 מ"ג פעמיים ביום בהתאם למידע המתועד לאחר הערכה פסיכיאטרית.',
    interventionsProvided: "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר המצב הדיכאוני, איכות השינה, התפקוד, המסוכנות וההיענות לטיפול התרופתי.",
  },
  {
    importKey: "legacy-2026-09-16-ruth-inperson",
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod" },
    type: "IN_PERSON",
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
    importKey: "legacy-2026-09-04-sarah-ashdod-virtual",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "VIRTUAL",
    patientStatusNote: "מצב הרוח במגמת התייצבות, עם חרדה שאריתית.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "מצב הרוח במגמת התייצבות לצד המשך מרכיב חרדתי. השבוע הראשון ללימודים עבר באופן משביע רצון יחסית. המטופלת שוללת מחשבות אובדניות.",
    currentMedication:
      "Lorivan הופסק. הטיפול ב־Leponex נמשך ללא שינוי בהתאם למידע המתועד בביקור.",
    interventionsProvided: "בוצעה הקשבה פעילה, חיזוק חיובי ופסיכו־הדרכה.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך מעקב אחר מצב הרוח, החרדה, התפקוד וההיענות והסבילות לטיפול התרופתי.",
  },
  {
    importKey: "legacy-2026-09-08-sarah-ashdod-inperson",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "IN_PERSON",
    patientStatusNote: "ניכר שיפור קליני. המטופלת פחות סדטיבית, רגועה וחיובית יותר.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "המטופלת פחות סדטיבית, רגועה וחיובית יותר. ממשיכה בלימודים פעמיים בשבוע ושומרת על פעילות חברתית מסוימת. קיימת אפשרות להשתלבות בעבודה כסייעת לילדים. הקשר מאורגן. במהלך הביקור לא נצפו באופן ספונטני תסמינים פסיכוטיים או קטטוניים.",
    currentMedication:
      "יש להסתמך על הטיפול המעודכן בתיק. לא תועד שינוי תרופתי במהלך ביקור זה.",
    interventionsProvided: "בוצעה הערכה קלינית, הקשבה פעילה, תמיכה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עידוד להתמדה בלימודים, בפעילות חברתית ובחזרה הדרגתית לתפקוד תעסוקתי. המשך מעקב קליני.",
  },
  {
    importKey: "legacy-2026-09-10-sarah-ashdod-inperson",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "IN_PERSON",
    patientStatusNote:
      "מצב הרוח יציב באופן כללי, עם מרכיב חרדתי שאריתי. קשר טוב וברית טיפולית טובה.",
    drivingRisk: "NOT_ASSESSED",
    mainProblems:
      "מצב הרוח יציב באופן כללי לצד המשך מרכיב חרדתי. קשר טוב וברית טיפולית טובה. המטופלת עבדה במהלך היום כמחליפה של סייעת. שוללת מחשבות אובדניות. במהלך הבדיקה לא נצפו תסמינים פסיכוטיים או קטטוניים.",
    currentMedication:
      "יש להסתמך על הטיפול המעודכן בתיק. לא תועד שינוי תרופתי במהלך ביקור זה.",
    interventionsProvided: "בוצעה הקשבה פעילה וחיזוק חיובי.",
    carePlan:
      "המשך מעקב במסגרת אשפוז בית. המשך עידוד לחזרה לתפקוד ולעבודה ומעקב אחר מצב הרוח והחרדה.",
  },
];

/** Compose transmission hébraïque déterministe — aucun fait ajouté. */
export function composeLegacyHebrewReport(input: {
  patientStatusNote: string | null;
  diagnosisNote: string | null;
  mainProblems: string | null;
  currentMedication: string | null;
  interventionsProvided: string | null;
  carePlan: string | null;
}) {
  const blocks: string[] = [];
  const push = (title: string, body: string | null | undefined) => {
    const text = body?.trim();
    if (!text) return;
    blocks.push(`${title}\n${text}`);
  };
  push("מצב המטופל", input.patientStatusNote);
  push("אבחנה", input.diagnosisNote);
  push("בעיות מרכזיות", input.mainProblems);
  push("טיפול תרופתי עדכני", input.currentMedication);
  push("הטיפול שניתן", input.interventionsProvided);
  push("תוכנית טיפול", input.carePlan);
  return blocks.join("\n\n");
}

export function diagnosisFromPatient(primary: string | null, secondary: string | null) {
  const lines = [primary, secondary].map((item) => item?.trim()).filter(Boolean) as string[];
  return lines.length > 0 ? lines.join("\n") : null;
}
