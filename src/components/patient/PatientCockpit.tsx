import Link from "next/link";

import { WeeklyHadCard } from "@/components/visits/WeeklyHadProgress";
import { pickNextAction } from "@/lib/clinical/cockpit";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";
import type { WeeklyHadProgress } from "@/lib/visits/had-week";
import { visitHrefForStatus, type WorkflowLabel } from "@/lib/visits/workflow-status";

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
  nextVisit,
  unfinished,
  tasks,
  summary,
  diagnosis,
  weekProgress,
}: {
  locale: Locale;
  patientId: string;
  today: string;
  nextVisit: VisitRow | null;
  unfinished: VisitRow | null;
  tasks: Array<{ id: string; title: string; status: string; priority: string; dueDate: Date | null }>;
  summary: string | null;
  diagnosis: string | null;
  weekProgress?: WeeklyHadProgress | null;
}) {
  const action = pickNextAction({
    patientId,
    today,
    tasks,
    unfinished: unfinished && unfinished.workflow !== "VALIDATED" ? { id: unfinished.id, status: unfinished.workflow } : null,
    nextVisitId: nextVisit?.id ?? null,
  });
  const openVisit = unfinished && unfinished.workflow !== "VALIDATED" ? unfinished : null;
  const actionLabel =
    action.kind === "task"
      ? action.title
      : action.kind === "visit"
        ? t(locale, actionKey(action.code))
        : action.kind === "scheduled" && nextVisit
          ? `${nextVisit.typeLabel} · ${formatWhen(nextVisit.occurredAt, locale)}`
          : t(locale, "newVisit");
  const sameVisit = action.kind === "visit" && openVisit != null;

  return (
    <section className="flex flex-col gap-3">
      {openVisit ? (
        <div className="flex flex-col gap-2">
          <Link
            href={visitHrefForStatus(patientId, openVisit.id, openVisit.workflow)}
            className="flex min-h-12 flex-col items-center justify-center rounded-synapse-md bg-accent px-4 py-2.5 text-center text-white synapse-transition"
          >
            <span className="text-base font-semibold leading-6">{t(locale, actionKey(resumeCode(openVisit.workflow)))}</span>
            <span className="text-xs font-medium text-white/75">
              {openVisit.typeLabel} · {formatWhen(openVisit.occurredAt, locale)}
            </span>
          </Link>
          <Link
            href={`/patients/${patientId}/visits/new`}
            className="flex min-h-10 items-center justify-center text-sm font-semibold text-accent"
          >
            {t(locale, "startAnotherVisit")}
          </Link>
        </div>
      ) : (
        <Link
          href={`/patients/${patientId}/visits/new`}
          className="flex min-h-12 items-center justify-center rounded-synapse-md bg-accent px-4 text-base font-semibold text-white synapse-transition"
        >
          {t(locale, "newVisit")}
        </Link>
      )}
      <WeeklyHadCard locale={locale} progress={weekProgress} />
      <div className="rounded-synapse-md bg-card px-4 py-4 ring-1 ring-line/70">
        <p className="text-[13px] font-semibold text-muted">{t(locale, "profileSummary")}</p>
        <p className="mt-2.5 whitespace-pre-wrap synapse-clinical-text text-ink">
          {summary?.trim() || t(locale, "profileEmpty")}
        </p>
        {diagnosis?.trim() ? <p className="mt-3 text-sm text-muted">{diagnosis}</p> : null}
      </div>
      {action.kind === "new" || sameVisit ? null : (
        <Link
          href={action.href}
          className="flex min-h-12 flex-col items-center justify-center rounded-synapse-md border border-accent/25 bg-accent-soft px-4 py-2 text-center text-accent synapse-transition"
        >
          <span className="text-xs font-medium text-accent/75">{t(locale, "cockpitAction")}</span>
          <span className="text-base font-semibold leading-6">{actionLabel}</span>
        </Link>
      )}
      <FollowUpForms locale={locale} patientId={patientId} />
    </section>
  );
}

function FollowUpForms({ locale, patientId }: { locale: Locale; patientId: string }) {
  const kinds = [
    ["TREATMENT", "kindTreatment"],
    ["CLINICAL", "kindClinical"],
    ["HOSPITALIZATION", "kindHospital"],
    ["EXAM", "kindExam"],
    ["CONTACT", "kindContact"],
    ["OTHER", "kindOther"],
  ] as const;

  return (
    <>
      <details className="rounded-synapse-md bg-accent-soft">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center px-3 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
          {t(locale, "addEvent")}
        </summary>
        <form action={`/api/patients/${patientId}/events`} method="post" className="flex flex-col gap-2 px-3 pb-3">
          <input name="title" required maxLength={160} placeholder={t(locale, "eventTitle")} className="min-h-11 rounded-xl bg-field px-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="kind" className="min-h-11 rounded-xl bg-field px-2 text-sm">
              {kinds.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(locale, label)}
                </option>
              ))}
            </select>
            <input name="occurredAt" type="date" required className="min-h-11 rounded-xl bg-field px-2 text-sm" />
          </div>
          <button className="min-h-11 rounded-xl bg-accent text-sm font-semibold text-white">{t(locale, "addEvent")}</button>
        </form>
      </details>
    </>
  );
}

function resumeCode(status: WorkflowLabel): "continue" | "transcribe" | "analyze" | "review" {
  if (status === "TRANSMISSION_GENERATED") return "review";
  if (status === "TRANSCRIBED") return "analyze";
  if (status === "AUDIO_READY") return "transcribe";
  return "continue";
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
