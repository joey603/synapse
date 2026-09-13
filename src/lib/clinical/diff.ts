import type { ExtractionChange, FactDomain, StoredExtraction } from "@/lib/clinical/types";
import { FACT_DOMAINS } from "@/lib/clinical/types";

export function diffValidated(
  current: StoredExtraction,
  previous: StoredExtraction | null,
): ExtractionChange[] {
  if (!previous) return [];

  const changes: ExtractionChange[] = [];
  for (const domain of FACT_DOMAINS) {
    const now = current.facts[domain];
    const before = previous.facts[domain];
    if (now.assertion === before.assertion) continue;
    if (now.temporality !== "current_visit" || now.source !== "transcript") continue;
    if (!now.evidence?.quote) continue;
    changes.push({ domain: domain as FactDomain, from: before.assertion, to: now.assertion });
  }
  return changes;
}
