import { JACKY_HAD_TRANSCRIPT, JACKY_SUICIDE_DENIAL_QUOTE } from "../../transcripts/jacky-had";

/**
 * Gold Case 001 — cas de référence pour la qualité des transmissions.
 * Ne jamais injecter ce gold standard dans ClinicalContext en génération réelle.
 */
export const GOLD_CASE_001 = {
  id: "gold-case-001",
  label: "Gold Case 001",
  patientLabel: "Jacky",
  /** Sexe dossier Patient.sex — jamais inféré. */
  sex: "MALE" as const,
  transcript: JACKY_HAD_TRANSCRIPT,
  /** Contexte isolé volontairement : pas d’historique / médocs d’un autre patient. */
  isolatedContext: [
    "PATIENT_ID=gold-case-001-patient-b",
    "=== PATIENT (dossier permanent de CE patient uniquement) ===",
    "Identité: Patient B.",
    "Sexe enregistré (dossier Patient.sex): MALE",
    "GENRE GRAMMATICAL OBLIGATOIRE: masculin uniquement (המטופל, הוא, אמר, תיאר).",
    "Interdit: המטופלת / היא / אמרה / תיארה pour ce patient.",
    "Ne pas inférer le genre depuis le prénom, la transcription, les partenaires mentionnés, ni l’historique textuel.",
    "",
    "=== AUTHORITATIVE TREATMENT (référence dossier CE patient — pas un constat du jour) ===",
    "Aucun médicament enregistré.",
    "",
    "=== VALIDATED HISTORY (transmissions VALIDATED de CE patient uniquement) ===",
    "Aucune transmission validée.",
    "",
    "=== CURRENT VISIT (métadonnées + Nurse Note ; la transcription suit séparément) ===",
    "Date: 2026-09-16. Type: IN_PERSON.",
  ].join("\n"),
} as const;

/** Thèmes cliniquement critiques à conserver (marqueurs génériques, pas de règle patient). */
export const GOLD_CASE_001_REQUIRED_MARKERS: Array<{
  id: string;
  label: string;
  patterns: RegExp[];
}> = [
  { id: "masculine_grammar", label: "genre masculin", patterns: [/המטופל(?!ת)/] },
  { id: "sleep", label: "sommeil", patterns: [/שינה|שנתי|בונדורמין|עייפ/i] },
  { id: "mood", label: "humeur", patterns: [/עצוב|עצב|מצב רוח|בוכה|בכי/i] },
  { id: "emptiness", label: "vide", patterns: [/ריקנ/i] },
  { id: "crying", label: "pleurs", patterns: [/בכי|בוכה|דמעות/i] },
  { id: "ocd", label: "rumination/OCD", patterns: [/OCD|אובסס|רומינ|בדיק/i] },
  { id: "relational", label: "fonctionnement relationnel", patterns: [/נטישה|דחייה|לבד|אישור|בטחון/i] },
  { id: "self_esteem", label: "estime de soi", patterns: [/הערכה עצמית|הערך העצמי|ביטחון ה?עצמי|תכונ|איכויות?/i] },
  {
    id: "nursing_interventions",
    label: "interventions infirmières",
    patterns: [/הקשבה|תמיכה|חיזוק|פסיכו.?הדרכ|אימות|וליד/i],
  },
  { id: "cbt", label: "interventions TCC", patterns: [/CBT|TCC|מחשבות אוטומטיות|פרשנות|עבודה קוגניטיבית/i] },
  {
    id: "suicidality_current",
    label: "suicidalité actuelle",
    patterns: [
      new RegExp(JACKY_SUICIDE_DENIAL_QUOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      /שולל.{0,40}אובדנ|אין.{0,20}מחשבות אובדנ|לא הי[וה].{0,10}מחשבות אובדנ/i,
    ],
  },
  {
    id: "suicidality_evolution",
    label: "évolution suicidalité",
    patterns: [
      /מחשבות האובדניות פחת/,
      /אובדנ\w*.{0,40}פחת/,
      /אובדנ\w*.{0,40}פחות/,
      /פחת.{0,30}אובדנ/,
      /פחות.{0,30}אובדנ/,
      /ירידה.{0,40}אובדנ/,
      /שיפור.{0,40}אובדנ/,
      /בעבר.{0,40}אובדנ/,
      /השתפר.{0,40}אובדנ/,
      /יש לי הרבה הרבה פחות/,
    ],
  },
  { id: "plan", label: "plan", patterns: [/מעקב|להמשיך|תוכנית|לתרגל|לכתוב|שינה|הערכה עצמית/i] },
];

export const GOLD_CASE_001_FORBIDDEN_MARKERS: Array<{ id: string; label: string; patterns: RegExp[] }> = [
  { id: "clozapine_leak", label: "Clozapine d’un autre patient", patterns: [/קלוזאפין|clozapin|Leponex|לפונקס/i] },
  {
    id: "mse_boilerplate",
    label: "MSE inventé",
    patterns: [/בהכרה מלאה|קשר עין תקין|התמצאות תקינה|אפקט תואם|שיפוט תקין/i],
  },
  { id: "feminine_grammar", label: "féminin grammatical incorrect", patterns: [/המטופלת/] },
  {
    id: "suicidality_softened",
    label: "négation actuelle adoucie en non-évalué",
    patterns: [/לא תוארו באופן מפורש מחשבות אובדניות/],
  },
  {
    id: "splitting_as_fact",
    label: "פיצול élevé en fait non étayé",
    patterns: [/דפוסי חשיבה בינאריים ופיצוליים|פיצוליים סביב/],
  },
];

export function evaluateGoldTransmission(text: string) {
  const missing = GOLD_CASE_001_REQUIRED_MARKERS.filter(
    (marker) => !marker.patterns.some((pattern) => pattern.test(text)),
  ).map((marker) => marker.id);
  const invented = GOLD_CASE_001_FORBIDDEN_MARKERS.filter((marker) =>
    marker.patterns.some((pattern) => pattern.test(text)),
  ).map((marker) => marker.id);
  return {
    ok: missing.length === 0 && invented.length === 0,
    missing,
    invented,
    length: text.trim().length,
  };
}
