import type { StoredExtraction } from "@/lib/clinical/types";

const RULES: Array<{ pattern: RegExp; field: keyof StoredExtraction["facts"] }> = [
  { pattern: /שולל מחשבות אובדני|אין מחשבות אובדני|nie les idées suicidaires/i, field: "suicidality" },
  { pattern: /שולל מחשבות שווא|אין פסיכוזה|sans élément psychotique|nie toute psychose/i, field: "psychosis" },
  { pattern: /שולל אלימות|אין מסוכנות לאחר|sans hétéro-agressivité/i, field: "aggression" },
  { pattern: /שולל שימוש בחומרים|אין שימוש בחומרים|nie toute consommation/i, field: "substanceUse" },
  { pattern: /שולל תופעות לוואי|אין תופעות לוואי|nie des effets secondaires/i, field: "sideEffects" },
];

/**
 * Silence ≠ négation : phrases d’absence de psychose inventées faute d’évaluation.
 * À retirer (pas remplacer par « לא הוערך ») lorsque psychosis n’est pas explicitly_denied.
 */
const PSYCHOSIS_SILENCE_CLAUSES: RegExp[] = [
  /לא\s+עלו\s+תכנים\s+פסיכוטיים[^.!?\n]*/gi,
  /לא\s+תוארו\s+תכנים\s+דלוזיונליים[^.!?\n]*/gi,
  /לא\s+תוארו\s+(?:היום\s+)?(?:תסמינים\s+)?פסיכוטיים[^.!?\n]*/gi,
  /לא\s+דווחו\s+הזיות[^.!?\n]*/gi,
  /לא\s+עלו\s+תכנים\s+של\s+הזיות(?:\s+או\s+מחשבות\s+שווא)?[^.!?\n]*/gi,
  /ולא\s+עלו\s+תכנים\s+של\s+הזיות(?:\s+או\s+מחשבות\s+שווא)?[^.!?\n]*/gi,
  /לא\s+תוארו\s+היום\s+תסמינים\s+פסיכוטיים[^.!?\n]*/gi,
];

export const NOT_ASSESSED_HE = "לא הוערך במפגש זה";

export function scrubForbidden(text: string, extraction: StoredExtraction) {
  let next = text;
  let replaced = false;

  for (const rule of RULES) {
    if (!rule.pattern.test(next)) continue;
    if (extraction.facts[rule.field].assertion === "explicitly_denied") continue;
    next = next.replace(rule.pattern, NOT_ASSESSED_HE);
    replaced = true;
  }

  // Psychose : silence ≠ négation clinique — supprimer les clauses d’absence inventées.
  const psychosis = extraction.facts.psychosis?.assertion;
  if (psychosis !== "explicitly_denied" && psychosis !== "present") {
    for (const pattern of PSYCHOSIS_SILENCE_CLAUSES) {
      if (!pattern.test(next)) continue;
      pattern.lastIndex = 0;
      next = next.replace(pattern, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1");
      replaced = true;
    }
  }

  return { text: next.trim(), replaced };
}

export function hebrewNeedsRewrite(extraction: StoredExtraction, proposed: string | null | undefined) {
  const text = proposed?.trim() ?? "";
  if (!text || extraction.downgraded.length > 0) return true;
  return scrubForbidden(text, extraction).replaced;
}
