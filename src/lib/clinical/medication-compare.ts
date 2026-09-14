import type { ClinicalFact } from "@/lib/clinical/types";

export type ChartMedication = { name: string; dose: string | null };

export type MedMatch = "match" | "absent" | "change" | "uncertain";

export type MentionRow = {
  tone: MedMatch;
  name: string;
  detail: string | null;
};

export function compareMedications(chart: ChartMedication[], mentions: ClinicalFact[]) {
  const rows: MentionRow[] = [];

  for (const mention of mentions) {
    if (mention.assertion !== "present" && mention.assertion !== "uncertain") continue;
    const spoken = (mention.value ?? mention.evidence?.quote ?? "").trim();
    if (!spoken) continue;
    const matched = chart.find((item) => namesMatch(item.name, spoken));
    const loose = mention.confidence !== "high" || mention.assertion === "uncertain";

    if (!matched) {
      rows.push({
        tone: loose ? "uncertain" : "absent",
        name: spoken,
        detail: null,
      });
      continue;
    }

    const chartDose = doseNumber(matched.dose);
    const spokenDose = doseNumber(spoken);
    if (!loose && chartDose !== null && spokenDose !== null && chartDose !== spokenDose) {
      rows.push({
        tone: "change",
        name: matched.name,
        detail: `${matched.dose ?? chartDose} → ${spokenDose}`,
      });
      continue;
    }

    rows.push({
      tone: loose ? "uncertain" : "match",
      name: matched.name,
      detail: matched.dose,
    });
  }

  return rows;
}

export function namesMatch(chartName: string, spoken: string) {
  const chart = normalizeName(chartName);
  const said = normalizeName(spoken);
  if (chart.length < 3 || said.length < 3) return false;
  return said.includes(chart) || chart.includes(said);
}

function doseNumber(value: string | null | undefined) {
  const match = value?.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
