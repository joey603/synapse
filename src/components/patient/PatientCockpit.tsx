import Link from "next/link";

import { otherRiskUnassessed, pickNextAction, riskReadout, type RiskReadout } from "@/lib/clinical/cockpit";
import type { StoredExtraction } from "@/lib/clinical/types";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";
import type { WorkflowLabel } from "@/lib/visits/workflow-status";

type VisitRow = {
  id: string;
  occurredAt: Date;
  typeLabel: string;
  workflow: WorkflowLabel;
};

export function PatientCockpit({
  locale,
  patientId,
  today,
  lastVisit,
  nextVisit,
  unfinished,
  tasks,
  extraction,
  treatment,
}: {
  locale: Locale;
  patientId: string;
  today: string;
  lastVisit: VisitRow | null;
  nextVisit: VisitRow | null;
  unfinished: VisitRow | null;
  tasks: Array<{ id: string; title: string; status: string; priority: string; dueDate: Date | null }>;
  extraction: StoredExtraction | null;
  treatment: { title: string; when: string | null } | null;
}) {
  const risk = riskReadout(extraction);
  const action = pickNextAction({
    patientId,
    today,
    tasks,
    unfinished: unfinished && unfinished.workflow !== "VALIDATED" ? { id: unfinished.id, status: unfinished.workflow } : null,
    nextVisitId: nextVisit?.id ?? null,
  });
  const actionLabel =
    action.kind === "task"
      ? action.title
      : action.kind === "visit"
        ? t(locale, actionKey(action.code))
        : action.kind === "scheduled" && nextVisit
          ? `${nextVisit.typeLabel} · ${formatWhen(nextVisit.occurredAt, locale)}`
          : t(locale, "newVisit");

  return (
    <section className="flex flex-col gap-3">
      <Link
        href={`/patients/${patientId}/visits/new`}
        className="flex min-h-12 items-center justify-center rounded-2xl bg-accent px-4 text-base font-semibold text-white"
      >
        {t(locale, "newVisit")}
      </Link>
      <div className={`rounded-2xl px-4 py-3 ${riskTone(risk)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t(locale, "cockpitRisk")}</p>
        <p className="mt-1 text-[15px] font-semibold leading-5">{t(locale, riskKey(risk))}</p>
        {otherRiskUnassessed(extraction) ? (
          <p className="mt-1 text-xs leading-5 opacity-80">{t(locale, "riskOthersMissing")}</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Fact label={t(locale, "cockpitLast")} value={lastVisit ? formatWhen(lastVisit.occurredAt, locale) : "—"} />
        <Fact label={t(locale, "cockpitNext")} value={nextVisit ? formatWhen(nextVisit.occurredAt, locale) : "—"} />
        <Fact label={t(locale, "cockpitTrend")} value={t(locale, "cockpitTrendUnknown")} wide />
      </dl>
      <div className="rounded-2xl bg-card px-3 py-3 ring-1 ring-line">
        <p className="text-xs font-medium text-muted">{t(locale, "cockpitTreatment")}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-ink">
          {treatment ? (treatment.when ? `${treatment.title} · ${treatment.when}` : treatment.title) : t(locale, "cockpitTreatmentUnknown")}
        </p>
      </div>
      {action.kind === "new" ? null : (
        <Link
          href={action.href}
          className="flex min-h-12 flex-col items-center justify-center rounded-2xl bg-accent px-4 py-2 text-center text-white"
        >
          <span className="text-xs font-medium text-white/75">{t(locale, "cockpitAction")}</span>
          <span className="text-base font-semibold leading-6">{actionLabel}</span>
        </Link>
      )}
    </section>
  );
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl bg-card px-3 py-3 ring-1 ring-line ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold leading-5 text-ink">{value}</dd>
    </div>
  );
}

function riskKey(risk: RiskReadout): MessageKey {
  if (risk === "present") return "riskPresent";
  if (risk === "uncertain") return "riskUncertain";
  if (risk === "denied") return "riskDenied";
  return "riskMissing";
}

function riskTone(risk: RiskReadout) {
  if (risk === "present") return "bg-danger-soft text-danger";
  if (risk === "uncertain") return "bg-terra-soft text-ink";
  return "bg-field text-ink";
}

function actionKey(code: "continue" | "transcribe" | "analyze" | "review"): MessageKey {
  if (code === "transcribe") return "actionTranscribe";
  if (code === "analyze") return "actionAnalyze";
  if (code === "review") return "actionReview";
  return "actionContinue";
}

function formatWhen(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
