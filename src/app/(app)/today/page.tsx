import Link from "next/link";
import { cookies } from "next/headers";

import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { formatJerusalemInput, jerusalemDateKey, jerusalemDayBounds } from "@/lib/visits/time";
import { visitHrefForStatus, workflowStatus, type WorkflowLabel } from "@/lib/visits/workflow-status";

export default async function TodayPage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const now = new Date();
  const { start, end } = jerusalemDayBounds(now);
  const today = jerusalemDateKey(now);
  const [visits, leftover, important] = await Promise.all([
    db.visit.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "asc" },
      include: {
        patient: { select: { firstName: true, lastName: true, city: true } },
        report: { select: { status: true } },
        recording: { select: { status: true } },
        transcript: { select: { id: true } },
        extraction: { select: { id: true } },
      },
    }),
    db.visit.findMany({
      where: {
        occurredAt: { lt: start },
        OR: [{ report: null }, { report: { is: { status: { not: "VALIDATED" } } } }],
      },
      orderBy: { occurredAt: "desc" },
      take: 12,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        report: { select: { status: true } },
        recording: { select: { status: true } },
        transcript: { select: { id: true } },
        extraction: { select: { id: true } },
      },
    }),
    db.task.count({
      where: {
        status: { not: "DONE" },
        priority: { in: ["IMPORTANT", "URGENT"] },
        OR: [{ dueDate: null }, { dueDate: { lte: new Date(`${today}T12:00:00.000Z`) } }],
      },
    }),
  ]);

  const dated = visits.map(withFlow);
  const openReports = dated.filter((visit) => visit.flow === "TRANSMISSION_GENERATED").length;
  const dateLabel = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "agendaToday")}</h1>
        <p className="mt-1 text-sm capitalize text-muted">{dateLabel}</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Count label={t(locale, "todayPlanned")} value={dated.length} />
        <Count label={t(locale, "todayInPerson")} value={dated.filter((visit) => visit.type === "IN_PERSON").length} />
        <Count label={t(locale, "todayVirtual")} value={dated.filter((visit) => visit.type === "VIRTUAL").length} />
        <Count label={t(locale, "todayOpenReports")} value={openReports} />
        <Count label={t(locale, "todayImportant")} value={important} wide />
      </div>

      {dated.length === 0 ? (
        <EmptyState title={t(locale, "agendaEmpty")} body={t(locale, "actionTodayHint")} />
      ) : (
        <SurfaceCard>
          {dated.map((visit, index) => (
            <VisitLine
              key={visit.id}
              locale={locale}
              href={visitHrefForStatus(visit.patientId, visit.id, visit.flow)}
              name={`${visit.patient.firstName} ${visit.patient.lastName}`}
              detail={`${t(locale, visitTypeLabel(visit.type))}${visit.patient.city ? ` · ${visit.patient.city}` : ""}`}
              flow={visit.flow}
              time={formatJerusalemInput(visit.occurredAt).slice(11)}
              first={index === 0}
            />
          ))}
        </SurfaceCard>
      )}

      {leftover.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">{t(locale, "sectionFinish")}</h2>
          <SurfaceCard>
            {leftover.map(withFlow).map((visit, index) => (
              <VisitLine
                key={visit.id}
                locale={locale}
                href={visitHrefForStatus(visit.patientId, visit.id, visit.flow)}
                name={`${visit.patient.firstName} ${visit.patient.lastName}`}
                detail={t(locale, visitTypeLabel(visit.type))}
                flow={visit.flow}
                time={new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
                  timeZone: "Asia/Jerusalem",
                  day: "numeric",
                  month: "short",
                }).format(visit.occurredAt)}
                first={index === 0}
              />
            ))}
          </SurfaceCard>
        </section>
      ) : null}
    </div>
  );
}

function VisitLine({
  locale,
  href,
  name,
  detail,
  flow,
  time,
  first,
}: {
  locale: ReturnType<typeof resolveLocale>;
  href: string;
  name: string;
  detail: string;
  flow: WorkflowLabel;
  time: string;
  first: boolean;
}) {
  const action = actionKey(flow);
  return (
    <div>
      {first ? null : <div className="border-t border-line/70" />}
      <Link href={href} className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 active:bg-surface/70">
        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-accent">{time}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{name}</span>
          <span className="block truncate text-sm text-muted">{detail}</span>
        </span>
        <span className={`max-w-[7.5rem] shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold leading-4 ${action ? "bg-accent text-white" : "bg-surface text-muted"}`}>
          {t(locale, action ?? workflowKey(flow))}
        </span>
      </Link>
    </div>
  );
}

function Count({ label, value, wide = false }: { label: string; value: number; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-card px-3 py-3 ring-1 ring-line ${wide ? "col-span-2" : ""}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function withFlow<T extends { report: { status: "DRAFT" | "AI_GENERATED" | "REVIEWED" | "VALIDATED" } | null; recording: { status: string } | null; transcript: { id: string } | null; extraction: { id: string } | null; pipelineStatus: "IDLE" | "UPLOADED" | "TRANSCRIBING" | "TRANSCRIBED" | "EXTRACTING" | "EXTRACTED" | "GENERATING" | "READY" | "FAILED" }>(visit: T) {
  return {
    ...visit,
    flow: workflowStatus({
      recordingStored: visit.recording?.status === "STORED",
      hasTranscript: Boolean(visit.transcript),
      hasExtraction: Boolean(visit.extraction),
      reportStatus: visit.report?.status,
      pipelineStatus: visit.pipelineStatus,
    }),
  };
}

function actionKey(status: WorkflowLabel): MessageKey | null {
  if (status === "VALIDATED") return null;
  if (status === "TRANSMISSION_GENERATED") return "actionReview";
  if (status === "ANALYZED") return "actionContinue";
  if (status === "TRANSCRIBED") return "actionAnalyze";
  if (status === "AUDIO_READY") return "actionTranscribe";
  return "actionContinue";
}

function workflowKey(status: WorkflowLabel): MessageKey {
  if (status === "VALIDATED") return "workflowValidated";
  if (status === "TRANSMISSION_GENERATED") return "workflowReport";
  if (status === "ANALYZED") return "workflowAnalyzed";
  if (status === "TRANSCRIBED") return "workflowTranscribed";
  if (status === "AUDIO_READY") return "workflowAudio";
  return "workflowDraft";
}
