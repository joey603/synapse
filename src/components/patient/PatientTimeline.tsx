import Link from "next/link";
import type { ClinicalEventKind, VisitType } from "@prisma/client";

import { visitHrefForStatus, type WorkflowLabel } from "@/lib/visits/workflow-status";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";

const PAGE = 20;

type VisitItem = {
  id: string;
  type: VisitType;
  occurredAt: Date;
  workflow: WorkflowLabel;
};

type EventItem = {
  id: string;
  kind: ClinicalEventKind;
  title: string;
  occurredAt: Date;
};

export function PatientTimeline({
  locale,
  patientId,
  visits,
  events,
  filter,
  page,
}: {
  locale: Locale;
  patientId: string;
  visits: VisitItem[];
  events: EventItem[];
  filter: string;
  page: number;
}) {
  const items = merge(visits, events, filter);
  const shown = items.slice(0, page * PAGE);
  const more = items.length > shown.length;
  const base = `/patients/${patientId}?tab=timeline`;

  return (
    <section className="flex flex-col gap-3">
      {filter === "all" ? null : (
        <p className="text-sm text-muted">
          {t(locale, filterKey(filter))}
          {" · "}
          <Link href={base} className="font-semibold text-accent">
            {t(locale, "tabTimeline")}
          </Link>
        </p>
      )}

      {shown.length === 0 ? <EmptyState title={t(locale, "timelineEmpty")} body={t(locale, "timelineHint")} /> : null}

      <div className="flex flex-col gap-2">
        {shown.map((item) =>
          item.kind === "visit" ? (
            <SurfaceCard key={item.id}>
              <Link
                href={visitHrefForStatus(patientId, item.id, item.workflow)}
                className="flex min-h-[4.5rem] items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{formatWhen(item.at, locale)}</span>
                  <span className="block text-sm text-muted">{t(locale, visitKey(item.type))}</span>
                </span>
                <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  {t(locale, workflowKey(item.workflow))}
                </span>
              </Link>
            </SurfaceCard>
          ) : item.kind === "event" && (item.eventKind === "TREATMENT" || item.eventKind === "HOSPITALIZATION") ? (
            <div
              key={item.id}
              className={`rounded-2xl bg-card px-4 py-3 ring-1 ${
                item.eventKind === "HOSPITALIZATION" ? "ring-accent/30" : "ring-terra/30"
              }`}
            >
              <p className={`text-xs font-semibold ${item.eventKind === "HOSPITALIZATION" ? "text-accent" : "text-terra"}`}>
                {t(locale, kindKey(item.eventKind))}
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink">{item.title}</p>
              <p className="text-xs text-muted">{formatWhen(item.at, locale)}</p>
            </div>
          ) : (
            <div key={item.id} className="px-1 py-1">
              <p className="text-xs text-faint">
                {t(locale, kindKey(item.eventKind))} · {formatWhen(item.at, locale)}
              </p>
              <p className="text-sm text-muted">{item.title}</p>
            </div>
          ),
        )}
      </div>

      {more ? (
        <Link href={`${base}&filter=${filter}&page=${page + 1}`} className="text-center text-sm font-semibold text-accent">
          {t(locale, "timelineMore")}
        </Link>
      ) : null}
    </section>
  );
}

type Row =
  | { kind: "visit"; id: string; at: Date; type: VisitType; workflow: WorkflowLabel }
  | { kind: "event"; id: string; at: Date; title: string; eventKind: ClinicalEventKind };

function merge(visits: VisitItem[], events: EventItem[], filter: string): Row[] {
  const rows: Row[] = [];
  if (filter === "all" || filter === "visits") {
    rows.push(...visits.map((visit) => ({ kind: "visit" as const, id: visit.id, at: visit.occurredAt, type: visit.type, workflow: visit.workflow })));
  }
  if (filter === "all" || filter === "treatment" || filter === "events") {
    rows.push(
      ...events
        .filter((event) => (filter === "treatment" ? event.kind === "TREATMENT" : filter === "events" ? event.kind !== "TREATMENT" : true))
        .map((event) => ({ kind: "event" as const, id: event.id, at: event.occurredAt, title: event.title, eventKind: event.kind })),
    );
  }
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function filterKey(id: string): MessageKey {
  if (id === "visits") return "filterVisits";
  if (id === "treatment") return "filterTreatment";
  if (id === "events") return "filterEvents";
  if (id === "tasks") return "filterTasks";
  return "filterAll";
}

function workflowKey(status: WorkflowLabel): MessageKey {
  if (status === "VALIDATED") return "workflowValidated";
  if (status === "TRANSMISSION_GENERATED") return "workflowReport";
  if (status === "ANALYZED") return "workflowAnalyzed";
  if (status === "TRANSCRIBED") return "workflowTranscribed";
  if (status === "AUDIO_READY") return "workflowAudio";
  return "workflowDraft";
}

function kindKey(kind: ClinicalEventKind): MessageKey {
  if (kind === "TREATMENT") return "kindTreatment";
  if (kind === "HOSPITALIZATION") return "kindHospital";
  if (kind === "EXAM") return "kindExam";
  if (kind === "CONTACT") return "kindContact";
  if (kind === "CLINICAL") return "kindClinical";
  return "kindOther";
}

function visitKey(type: VisitType): MessageKey {
  if (type === "VIRTUAL") return "visitVirtual";
  if (type === "PHONE") return "visitPhone";
  if (type === "ADMISSION") return "visitAdmission";
  if (type === "ASSESSMENT") return "visitAssessment";
  if (type === "FAMILY_CONTACT") return "visitFamily";
  if (type === "OTHER") return "visitOther";
  return "visitInPerson";
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
