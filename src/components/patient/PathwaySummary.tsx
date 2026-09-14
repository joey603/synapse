import type { ClinicalEventKind, VisitType } from "@prisma/client";

import { parseStored } from "@/lib/clinical/schema";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { RISK_DOMAINS } from "@/lib/clinical/types";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";

const RISK_LABEL: Record<(typeof RISK_DOMAINS)[number], MessageKey> = {
  suicidality: "domainSuicidality",
  suicideIntent: "domainSuicideIntent",
  suicidePlan: "domainSuicidePlan",
  recentSuicidalBehavior: "domainRecentSuicidal",
  selfHarm: "domainSelfHarm",
  psychosis: "domainPsychosis",
  aggression: "domainAggression",
  impulsivity: "domainImpulsivity",
  dangerousness: "domainDangerousness",
  substanceUse: "domainSubstanceUse",
  sideEffects: "domainSideEffects",
};

export function PathwaySummary({
  locale,
  admittedAt,
  now,
  visits,
  events,
  facts,
}: {
  locale: Locale;
  admittedAt: Date | null;
  now: Date;
  visits: Array<{ id: string; type: VisitType; occurredAt: Date }>;
  events: Array<{ id: string; kind: ClinicalEventKind; title: string; occurredAt: Date }>;
  facts: Array<{ at: Date; payload: unknown }>;
}) {
  const windows = [
    block(locale, "pathway7", daysAgo(now, 7), now, visits, events, facts),
    block(locale, "pathway30", daysAgo(now, 30), now, visits, events, facts),
    admittedAt ? block(locale, "pathwaySince", admittedAt, now, visits, events, facts) : null,
  ].filter((item) => item && item.lines.length > 0);

  if (windows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-muted">{t(locale, "pathwayTitle")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted">{t(locale, "pathwayNote")}</p>
      </div>
      {windows.map((window) =>
        window ? (
          <div key={window.label} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-line">
            <p className="text-xs font-semibold text-muted">{t(locale, window.label)}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {window.lines.map((line) => (
                <li key={line} className="text-sm leading-5 text-ink">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  );
}

function block(
  locale: Locale,
  label: "pathway7" | "pathway30" | "pathwaySince",
  start: Date,
  end: Date,
  visits: Array<{ id: string; type: VisitType; occurredAt: Date }>,
  events: Array<{ id: string; kind: ClinicalEventKind; title: string; occurredAt: Date }>,
  facts: Array<{ at: Date; payload: unknown }>,
) {
  const lines: string[] = [];
  const inside = (date: Date) => date >= start && date <= end;

  for (const visit of visits.filter((visit) => inside(visit.occurredAt)).slice(0, 4)) {
    lines.push(`${formatDay(visit.occurredAt, locale)} · ${t(locale, visitTypeLabel(visit.type))}`);
  }
  for (const event of events.filter((event) => inside(event.occurredAt) && (event.kind === "TREATMENT" || event.kind === "HOSPITALIZATION")).slice(0, 3)) {
    lines.push(`${formatDay(event.occurredAt, locale)} · ${event.title}`);
  }
  for (const fact of facts.filter((fact) => inside(fact.at))) {
    const stored = parseStored(fact.payload);
    if (!stored) continue;
    for (const domain of RISK_DOMAINS) {
      if (stored.facts[domain]?.assertion !== "present") continue;
      lines.push(`${formatDay(fact.at, locale)} · ${t(locale, RISK_LABEL[domain])}`);
      if (lines.length >= 8) break;
    }
  }

  return { label, lines: unique(lines).slice(0, 8) };
}

function unique(lines: string[]) {
  return [...new Set(lines)];
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function formatDay(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
  }).format(date);
}
