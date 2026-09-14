import { compareMedications, type ChartMedication } from "@/lib/clinical/medication-compare";
import type { Assertion, FactDomain, StoredExtraction } from "@/lib/clinical/types";
import { CLINICAL_DOMAINS, RISK_DOMAINS } from "@/lib/clinical/types";

export type ReviewItemCode =
  | "risk_missing"
  | "suicide_present"
  | "suicide_uncertain"
  | "dose_uncertain"
  | "med_absent"
  | "dose_change"
  | "chart_quiet"
  | "contradiction"
  | "downgraded"
  | "uncertain_fact"
  | "gap";

export type ReviewItem = { code: ReviewItemCode; domain?: FactDomain };

export type VisitDelta = {
  domain: FactDomain;
  from: Assertion;
  to: Assertion;
  historical: boolean;
};

export type ComparisonRow = {
  domain: FactDomain;
  from: Assertion;
  to: Assertion;
  incomparable: boolean;
};

const IMPORTANT = new Set<FactDomain>([...RISK_DOMAINS, ...CLINICAL_DOMAINS]);

export function reviewItems(
  extraction: StoredExtraction,
  chart: ChartMedication[],
  previous: StoredExtraction | null = null,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  const suicide = extraction.facts.suicidality;

  if (suicide.assertion === "not_assessed" || suicide.assertion === "not_reported") {
    items.push({ code: "risk_missing", domain: "suicidality" });
  }
  if (suicide.assertion === "present") items.push({ code: "suicide_present", domain: "suicidality" });
  if (suicide.assertion === "uncertain") items.push({ code: "suicide_uncertain", domain: "suicidality" });

  for (const domain of RISK_DOMAINS) {
    const fact = extraction.facts[domain];
    if (domain === "suicidality") continue;
    if (fact.assertion === "uncertain") items.push({ code: "uncertain_fact", domain });
  }

  for (const domain of CLINICAL_DOMAINS) {
    if (extraction.facts[domain].assertion === "uncertain") {
      items.push({ code: "uncertain_fact", domain });
    }
  }

  const mentions = compareMedications(chart, extraction.medicationMentions);
  if (mentions.some((row) => row.tone === "uncertain")) items.push({ code: "dose_uncertain" });
  if (mentions.some((row) => row.tone === "absent")) items.push({ code: "med_absent" });
  if (mentions.some((row) => row.tone === "change")) items.push({ code: "dose_change" });

  const cited = mentions.length > 0;
  if (cited && chart.some((item) => !mentions.some((row) => row.tone === "match" && namesClose(item.name, row.name)))) {
    items.push({ code: "chart_quiet" });
  }

  if (
    extraction.contradictions.length > 0 ||
    extraction.changes.some((change) => change.to !== "not_assessed" && change.to !== "not_reported")
  ) {
    items.push({ code: "contradiction" });
  }
  if (extraction.medicationDiscrepancies.length > 0) items.push({ code: "dose_change" });
  if (extraction.downgraded.length > 0) items.push({ code: "downgraded" });
  if (visitDeltas(extraction, previous).some((delta) => delta.historical)) {
    items.push({ code: "gap" });
  }

  return items;
}

export function visitDeltas(current: StoredExtraction, previous: StoredExtraction | null): VisitDelta[] {
  if (!previous) return [];
  const deltas: VisitDelta[] = [];

  for (const domain of [...RISK_DOMAINS, ...CLINICAL_DOMAINS, "protectiveFactors"] as FactDomain[]) {
    const now = current.facts[domain];
    const before = previous.facts[domain];
    if (!before || now.assertion === before.assertion) continue;
    if (!IMPORTANT.has(domain) && domain !== "protectiveFactors") continue;

    const todayMissing = now.assertion === "not_assessed" || now.assertion === "not_reported";
    const beforeKnown = before.assertion === "present" || before.assertion === "explicitly_denied";
    if (todayMissing && beforeKnown) {
      deltas.push({ domain, from: before.assertion, to: now.assertion, historical: true });
      continue;
    }

    const listed = current.changes.find((change) => change.domain === domain);
    if (listed) deltas.push({ domain, from: listed.from, to: listed.to, historical: false });
  }

  return deltas;
}

export function comparisonRows(current: StoredExtraction, previous: StoredExtraction | null): ComparisonRow[] {
  if (!previous) return [];
  const rows: ComparisonRow[] = [];

  for (const domain of IMPORTANT) {
    const now = current.facts[domain];
    const before = previous.facts[domain];
    if (!now || !before) continue;
    const nowKnown = known(now.assertion);
    const beforeKnown = known(before.assertion);
    if (!nowKnown && !beforeKnown) continue;
    if (nowKnown !== beforeKnown) {
      rows.push({ domain, from: before.assertion, to: now.assertion, incomparable: true });
      continue;
    }
    if (now.assertion !== before.assertion) {
      rows.push({ domain, from: before.assertion, to: now.assertion, incomparable: false });
    }
  }

  return rows;
}

function known(assertion: Assertion) {
  return assertion === "present" || assertion === "explicitly_denied" || assertion === "uncertain";
}

function namesClose(chartName: string, spoken: string) {
  const chart = chartName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const said = spoken.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return chart.length >= 3 && said.length >= 3 && (said.includes(chart) || chart.includes(said));
}
