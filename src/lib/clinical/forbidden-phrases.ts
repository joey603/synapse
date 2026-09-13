import type { StoredExtraction } from "@/lib/clinical/types";

const RULES: Array<{ pattern: RegExp; field: keyof StoredExtraction["facts"] }> = [
  { pattern: /שולל מחשבות אובדני|אין מחשבות אובדני|nie les idées suicidaires/i, field: "suicidality" },
  { pattern: /שולל מחשבות שווא|אין פסיכוזה|sans élément psychotique|nie toute psychose/i, field: "psychosis" },
  { pattern: /שולל אלימות|אין מסוכנות לאחר|sans hétéro-agressivité/i, field: "aggression" },
  { pattern: /שולל שימוש בחומרים|אין שימוש בחומרים|nie toute consommation/i, field: "substanceUse" },
  { pattern: /שולל תופעות לוואי|אין תופעות לוואי|nie des effets secondaires/i, field: "sideEffects" },
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

  return { text: next, replaced };
}
