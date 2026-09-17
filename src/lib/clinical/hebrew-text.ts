/**
 * Détecte un texte clinique majoritairement latin (anglais) à ne pas exposer
 * dans l’UI Analyse / projections hébraïques.
 */
export function isPredominantlyLatin(text: string): boolean {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const hebrew = (text.match(/[\u0590-\u05FF]/g) ?? []).length;
  if (latin === 0) return false;
  // Acronymes hébreux + CBT/TCC/OCD/HAD tolérés s’il y a de l’hébreu.
  if (hebrew >= 3 && latin <= hebrew + 6) return false;
  return latin >= 6 && latin > hebrew;
}

/** Retourne le texte s’il est utilisable en hébreu clinique ; sinon null. */
export function hebrewClinicalText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (isPredominantlyLatin(text)) return null;
  return text;
}
