import { countDocumentedCurrentFacts } from "@/lib/clinical/zebra-projection";
import type { StoredExtraction, VisitRelevance } from "@/lib/clinical/types";

const CLINICAL_CUE =
  /מטופל|מטופלת|ביקור|סיעוד|תרופ|מינון|שינה|חרד|דיכאון|מצב\s*רוח|אובדנ|סואציד|התאבד|פסיכו|טיפול|הערכ|תלונ|כאבים?|patient|nurse|visit|medication|dose|sleep|anxiety|depress|suicid|mood|psych|HAD|soignant|visite|médic|sommeil|anxiété|dépress/i;

/** Contenu hors sujet clinique : pas de transmission. */
export function isUnrelatedVisitContent(
  extraction: StoredExtraction,
  transcript: string,
): boolean {
  if (extraction.visitRelevance === "unrelated") return true;
  if (extraction.visitRelevance === "clinical") return false;

  const documented = countDocumentedCurrentFacts(extraction);
  const hasWork =
    documented > 0 ||
    extraction.interventions.length > 0 ||
    extraction.plan.length > 0 ||
    extraction.medicationMentions.some(
      (item) => item.assertion === "present" || item.assertion === "explicitly_denied",
    );

  if (hasWork) return false;

  const text = transcript.trim();
  if (text.length < 40) return false;
  return !CLINICAL_CUE.test(text);
}

export function readVisitRelevance(value: unknown): VisitRelevance | null {
  if (value === "clinical" || value === "unrelated" || value === "unclear") return value;
  return null;
}
