import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Transcription réelle HAD (fixture de non-régression — pas de règle spécifique patient). */
export const JACKY_HAD_TRANSCRIPT = readFileSync(
  join(__dirname, "jacky-had-he.txt"),
  "utf8",
);

export const JACKY_SUICIDE_DENIAL_QUOTE = "היום לא היה לי מחשבות אובדניות";

/**
 * Extraction structurée attendue (forme OpenAI) — citations réellement présentes
 * dans la transcription. Sert de non-régression pour validation + projection Zebra.
 */
export function jackyExpectedRawExtraction() {
  return {
    facts: {
      mood: evidenced("present", "היום קמתי ממש עצוב, בכיתי, היה לי תחושה של ריקנות", {
        value: "עצב, בכי ותחושת ריקנות",
      }),
      sleep: evidenced("present", "שנתי גם כן איזה שעה וחצי, ואני לוקח את הבונדורמין", {
        value: "שינה מועטה ~1.5–2.5 שעות, עייפות בבוקר, בונדורמין",
      }),
      anxiety: evidenced("present", "העצים לי את ה-OCD", {
        value: "רומינציה / OCD, צורך בודאות, פרשנות יתר",
      }),
      thoughtContent: evidenced("present", "העצים לי את ה-OCD", {
        value: "מחשבות אובססיביות ורומינציה",
      }),
      suicidality: {
        assertion: "explicitly_denied",
        value: null,
        confidence: "high",
        evidences: [
          {
            quote: JACKY_SUICIDE_DENIAL_QUOTE,
            speaker: "PATIENT",
            source: "TRANSCRIPT",
            temporality: "CURRENT",
          },
        ],
      },
      // Peur relationnelle — pas un fait de fonctionnement.
      isolation: evidenced("present", "אני מפחד להיות לבד", {
        value: "פחד מדחייה / נטישה, פחד מבדידות, צורך באישור",
      }),
      insight: evidenced("present", "עכשיו אני איתך מדבר יותר נכון", {
        value: "תובנה חלקית לדפוסי פרשנות יתר ובדיקות",
      }),
      behavior: evidenced("present", "העצים לי את ה-OCD", {
        value: "בדיקות חוזרות וחיפוש סימנים בקשר",
      }),
    },
    longitudinal: {
      suicidality: "improved",
      sleep: "worsened",
    },
    interventions: [
      cited("הקשבה פעילה, תמיכה והכלה", "איך אתה מרגיש"),
      cited("פסיכו־חינוך והדרכה טיפולית", "העצים לי את ה-OCD"),
      cited("עבודה קוגניטיבית CBT/TCC: הבחנה בין עובדה לפרשנות", "העצים לי את ה-OCD"),
      cited("עבודה על הפחתת בדיקות וסבילות לאי־ודאות", "העצים לי את ה-OCD"),
      cited("חיזוק חיובי וחיזוק זיהוי מנגנונים", "עכשיו אני איתך מדבר יותר נכון"),
      cited("עבודה על הערכה עצמית וזיהוי תכונות חיוביות", "עכשיו אני איתך מדבר יותר נכון"),
      cited("הערכת סיכון אובדני", JACKY_SUICIDE_DENIAL_QUOTE),
    ],
    plan: [
      cited("המשך עבודה CBT על רומינציה, בדיקות ופרשנות יתר", "העצים לי את ה-OCD"),
      cited("מעקב שינה ועייפות", "שנתי גם כן איזה שעה וחצי"),
      cited("המשך הערכת מסוכנות / מחשבות אובדניות", JACKY_SUICIDE_DENIAL_QUOTE),
      cited("המשך חיזוק הערכה עצמית ותרגיל זיהוי תכונות חיוביות", "עכשיו אני איתך מדבר יותר נכון"),
      cited("המשך מסגרת HAD ומעקב בין־אישי", "אני מפחד להיות לבד"),
    ],
    medicationDiscrepancies: [
      // Divergence inventée hors transcript (Clozapine) — doit être droppée.
      {
        medication: "clozapine",
        recordDose: "250 mg",
        reportedDose: "250 mg",
        evidence: [
          {
            quote: "אני לוקח את הבונדורמין.",
            speaker: "PATIENT",
            source: "TRANSCRIPT",
            temporality: "CURRENT",
          },
        ],
      },
    ],
    contradictions: [],
    pointsToVerify: [],
    suggestedTasks: ["מעקב אחר השינה ובונדורמין"],
    finalReportHe: null,
  };
}

function evidenced(
  assertion: "present" | "explicitly_denied",
  quote: string,
  extra: { value?: string | null } = {},
) {
  return {
    assertion,
    value: extra.value ?? null,
    confidence: "high",
    evidences: [
      {
        quote,
        speaker: "PATIENT",
        source: "TRANSCRIPT",
        temporality: "CURRENT",
      },
    ],
  };
}

function cited(text: string, quote: string) {
  return {
    text,
    evidence: [
      {
        quote,
        speaker: "NURSE",
        source: "TRANSCRIPT",
        temporality: "CURRENT",
      },
    ],
  };
}
