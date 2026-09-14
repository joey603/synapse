import type { ReviewFlag, StoredExtraction } from "@/lib/clinical/types";

export function reviewFlags(
  extraction: StoredExtraction,
  chartMedicationNames: string[],
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const suicide = extraction.facts.suicidality;

  if (suicide.assertion === "present") flags.push({ code: "suicide_mentioned", domain: "suicidality" });
  if (suicide.assertion === "uncertain") flags.push({ code: "suicide_uncertain", domain: "suicidality" });

  const looseDose = extraction.medicationMentions.some(
    (mention) =>
      (mention.assertion === "present" || mention.assertion === "uncertain") &&
      mention.confidence !== "high",
  );
  if (looseDose) flags.push({ code: "dose_uncertain" });

  const mentioned = extraction.medicationMentions
    .filter((item) => item.assertion === "present")
    .map((item) => normalizeName(item.value))
    .filter(Boolean);

  for (const mention of extraction.medicationMentions) {
    const name = normalizeName(mention.value);
    if (name && mention.assertion === "present" && !chartMedicationNames.some((item) => normalizeName(item) === name)) {
      flags.push({ code: "medication_not_in_chart" });
      break;
    }
  }
  if (mentioned.length > 0) {
    for (const chart of chartMedicationNames) {
      if (!mentioned.includes(normalizeName(chart))) {
        flags.push({ code: "chart_medication_not_mentioned" });
        break;
      }
    }
  }

  if (extraction.changes.length > 0 || extraction.contradictions.length > 0) flags.push({ code: "contradiction" });
  if (extraction.medicationDiscrepancies.length > 0) flags.push({ code: "dose_uncertain" });
  if (extraction.downgraded.length > 0) flags.push({ code: "downgraded" });

  return flags;
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
}
