import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnalysisView } from "@/components/visits/AnalysisView";
import { AudioUploader } from "@/components/visits/AudioUploader";
import { LiveRecorder } from "@/components/visits/LiveRecorder";
import { PipelineProgress } from "@/components/visits/PipelineProgress";
import { ReportEditor } from "@/components/visits/ReportEditor";
import { TranscriptEditor } from "@/components/visits/TranscriptEditor";
import { BackChevron } from "@/components/ui/BackChevron";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { compareMedications } from "@/lib/clinical/medication-compare";
import { comparisonRows, reviewItems, type ReviewItemCode } from "@/lib/clinical/review-view";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { parseStored } from "@/lib/clinical/schema";
import type { ClinicalFact, Evolution, EvidenceTime, FactDomain, Speaker } from "@/lib/clinical/types";
import { CLINICAL_DOMAINS, EXAM_DOMAINS, RISK_DOMAINS } from "@/lib/clinical/types";
import { db, join } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { workflowStatus } from "@/lib/visits/workflow-status";

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; visitId: string }>;
  searchParams: Promise<{ audio?: string; tab?: string; run?: string; pipe?: string; src?: string }>;
}) {
  const { id, visitId } = await params;
  const { audio, tab = "transcript", run, pipe, src } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const visit = await db.visit.findFirst({
    ...join,
    where: { id: visitId, patientId: id },
    include: {
      patient: { include: { medications: { where: { active: true }, orderBy: { name: "asc" }, select: { name: true, dose: true } } } },
      report: true,
      recording: true,
      transcript: true,
      extraction: true,
    },
  });
  if (!visit) notFound();

  const previous = await db.clinicalExtraction.findFirst({
    where: { visit: { patientId: id, id: { not: visit.id }, report: { status: "VALIDATED" } } },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  const extraction = parseStored(visit.extraction?.payload);
  const previousExtraction = parseStored(previous?.payload);
  const busy = ["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus);
  const validated = visit.report?.status === "VALIDATED";
  const flow = workflowStatus({
    recordingStored: visit.recording?.status === "STORED",
    hasTranscript: Boolean(visit.transcript),
    hasExtraction: Boolean(visit.extraction),
    reportStatus: visit.report?.status,
    pipelineStatus: visit.pipelineStatus,
  });
  const statusLabel = t(
    locale,
    flow === "VALIDATED"
      ? "workflowValidated"
      : flow === "TRANSMISSION_GENERATED"
        ? "workflowReport"
        : flow === "ANALYZED"
          ? "workflowAnalyzed"
          : flow === "TRANSCRIBED"
            ? "workflowTranscribed"
            : flow === "AUDIO_READY"
              ? "workflowAudio"
              : "workflowDraft",
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/patients/${id}?tab=timeline`} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted">
        <BackChevron locale={locale} />
        {visit.patient.firstName} {visit.patient.lastName}
      </Link>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, visitTypeLabel(visit.type))}</h1>
          <p className="mt-1 text-sm text-muted">{t(locale, "visitNext")}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
          {statusLabel}
        </span>
      </header>
      <AudioPanel locale={locale} visitId={visit.id} recording={visit.recording} audio={audio} />
      {visit.recording?.status === "STORED" || visit.transcript ? (
        <SurfaceCard className="flex flex-col gap-4 p-4">
          <PipelineProgress
            visitId={visit.id}
            status={visit.pipelineStatus}
            polling={run === "1" || ["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus)}
            labels={[
              t(locale, "stepUpload"),
              t(locale, "stepTranscribe"),
              t(locale, "stepExtract"),
              t(locale, "stepReport"),
            ]}
          />
          {pipeMessage(locale, visit.failureCode ?? pipe) ? (
            <p className="text-sm leading-6 text-danger" role="alert">
              {pipeMessage(locale, visit.failureCode ?? pipe)}
            </p>
          ) : null}
          {!busy && !validated && !visit.transcript && visit.recording?.status === "STORED" ? (
            <form action={`/api/visits/${visit.id}/pipeline`} method="post">
              <input type="hidden" name="mode" value="transcribe" />
              <button type="submit" className="min-h-12 w-full rounded-2xl bg-accent text-sm font-semibold text-white">
                {visit.pipelineStatus === "FAILED" ? t(locale, "retryPipeline") : t(locale, "startPipeline")}
              </button>
            </form>
          ) : null}
          {!busy && !validated && visit.transcript ? (
            <form action={`/api/visits/${visit.id}/pipeline`} method="post" className="flex flex-col gap-3">
              <input type="hidden" name="mode" value="analyze" />
              {visit.report?.status === "REVIEWED" || pipe === "confirm" ? (
                <label className="flex items-start gap-3 text-sm leading-6 text-ink">
                  <input type="checkbox" name="confirm" required className="mt-1 h-4 w-4 accent-accent" />
                  {t(locale, "confirmOverwrite")}
                </label>
              ) : null}
              <button type="submit" className="min-h-12 w-full rounded-2xl bg-accent text-sm font-semibold text-white">
                {t(locale, "analyzeVisit")}
              </button>
            </form>
          ) : null}
        </SurfaceCard>
      ) : null}
      {visit.transcript ? (
        <>
          <Suspense fallback={null}>
            <SegmentedControl
              segments={[
                { id: "transcript", label: t(locale, "tabTranscript"), href: `/patients/${id}/visits/${visit.id}?tab=transcript` },
                { id: "analysis", label: t(locale, "tabAnalysis"), href: `/patients/${id}/visits/${visit.id}?tab=analysis` },
                { id: "report", label: t(locale, "tabReport"), href: `/patients/${id}/visits/${visit.id}?tab=report` },
              ]}
            />
          </Suspense>
          {tab === "analysis" ? (
            extraction ? (
              <>
                <AnalysisPanel
                  locale={locale}
                  visitId={visit.id}
                  patientId={id}
                  extraction={extraction}
                  previous={previousExtraction}
                  chart={visit.patient.medications}
                />
                <AnalysisExtras locale={locale} patientId={id} visitId={visit.id} extraction={extraction} />
              </>
            ) : (
              <p className="text-sm text-muted">{t(locale, "analysisEmpty")}</p>
            )
          ) : tab === "report" && visit.report?.editedDraft ? (
            <>
              {extraction ? (
                <ReviewBanner
                  locale={locale}
                  patientId={id}
                  visitId={visit.id}
                  extraction={extraction}
                  chart={visit.patient.medications}
                  previous={previousExtraction}
                />
              ) : null}
            <ReportEditor
              visitId={visit.id}
              initialText={visit.report.status === "VALIDATED" ? visit.report.finalText ?? visit.report.editedDraft : visit.report.editedDraft}
              validated={visit.report.status === "VALIDATED"}
              status={visit.report.status}
              labels={{
                copy: t(locale, "copyReport"),
                copyWarn: t(locale, "copyUnvalidated"),
                validate: t(locale, "validateReport"),
                regenerate: t(locale, "regenerate"),
                shorten: t(locale, "shorten"),
                moreClinical: t(locale, "moreClinical"),
                correctHebrew: t(locale, "correctHebrew"),
                confirmOverwrite: t(locale, "confirmOverwrite"),
                saved: t(locale, "saveQuiet"),
                lost: t(locale, "saveLost"),
                help: t(locale, "reportHelp"),
                confirmNeeded: visit.report.status === "REVIEWED" || pipe === "confirm",
              }}
            />
            </>
          ) : tab === "report" ? (
            <p className="text-sm text-muted">{t(locale, "analysisEmpty")}</p>
          ) : (
            <SurfaceCard className="p-4">
              <TranscriptEditor
                visitId={visit.id}
                initialText={visit.transcript.rawText}
                originalText={visit.transcript.providerText}
                locked={validated}
                edited={Boolean(visit.transcript.editedAt)}
                highlight={src}
                labels={{
                  raw: t(locale, "transcriptRaw"),
                  edited: t(locale, "transcriptEdited"),
                  note: t(locale, "transcriptNote"),
                  saving: t(locale, "transcriptSaving"),
                  saved: t(locale, "transcriptSaved"),
                  lost: t(locale, "saveLost"),
                  source: t(locale, "seeSource"),
                  original: t(locale, "originalTranscript"),
                  corrected: t(locale, "correctedTranscript"),
                }}
              />
            </SurfaceCard>
          )}
        </>
      ) : null}
      <details className="rounded-2xl bg-terra-soft">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-terra">{t(locale, "addTask")}</summary>
        <form action={`/api/patients/${id}/tasks`} method="post" className="flex flex-col gap-2 px-4 pb-4">
          <input type="hidden" name="visitId" value={visit.id} />
          <input type="hidden" name="next" value={`/patients/${id}/visits/${visit.id}`} />
          <input name="title" required maxLength={160} placeholder={t(locale, "eventTitle")} className="min-h-12 rounded-xl bg-field px-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="priority" className="min-h-12 rounded-xl bg-field px-2 text-sm">
              <option value="NORMAL">{t(locale, "priorityNormal")}</option>
              <option value="IMPORTANT">{t(locale, "priorityImportant")}</option>
              <option value="URGENT">{t(locale, "priorityUrgent")}</option>
            </select>
            <input name="dueDate" type="date" className="min-h-12 rounded-xl bg-field px-2 text-sm" />
          </div>
          <button className="min-h-12 rounded-xl bg-terra text-sm font-semibold text-white">{t(locale, "addTask")}</button>
        </form>
      </details>
    </div>
  );
}

function AudioPanel({
  locale,
  visitId,
  recording,
  audio,
}: {
  locale: ReturnType<typeof resolveLocale>;
  visitId: string;
  recording: {
    id: string;
    status: string;
    originalFilename: string | null;
    mimeType: string;
    sizeBytes: number;
  } | null;
  audio?: string;
}) {
  const stored = recording?.status === "STORED" ? recording : null;
  const errorKey = audioErrorKey(audio);

  if (stored) {
    return (
      <div className="flex flex-col gap-3">
        {errorKey ? (
          <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
            {t(locale, errorKey)}
          </p>
        ) : null}
        <SurfaceCard className="flex flex-col gap-4 p-4" id="audio">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t(locale, "audioTitle")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t(locale, "audioKept")}</p>
        </div>
        <div>
          <p className="truncate text-[15px] font-semibold text-ink">
            {stored.originalFilename ?? stored.mimeType}
          </p>
          <p className="text-sm text-muted">{formatBytes(stored.sizeBytes)}</p>
        </div>
        <form action={`/api/recordings/${stored.id}`} method="post">
          <button type="submit" className="min-h-12 w-full rounded-2xl bg-danger-soft text-sm font-semibold text-danger">
            {t(locale, "audioDelete")}
          </button>
        </form>
      </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {errorKey ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
          {t(locale, errorKey)}
        </p>
      ) : null}
      <LiveRecorder
        action={`/api/visits/${visitId}/audio`}
        title={t(locale, "recordTitle")}
        hint={t(locale, "recordHint")}
        startLabel={t(locale, "recordStart")}
        pauseLabel={t(locale, "recordPause")}
        resumeLabel={t(locale, "recordResume")}
        stopLabel={t(locale, "recordStop")}
        cancelLabel={t(locale, "recordCancel")}
        deniedLabel={t(locale, "recordDenied")}
        unsupportedLabel={t(locale, "recordUnsupported")}
        sendingLabel={t(locale, "recordSending")}
        tooBigLabel={t(locale, "audioErrorSize")}
        saveLabel={t(locale, "audioErrorSave")}
      />
      <AudioUploader
        action={`/api/visits/${visitId}/audio`}
        title={t(locale, "audioTitle")}
        hint={t(locale, "audioHint")}
        chooseLabel={t(locale, "audioChoose")}
        submitLabel={t(locale, "audioSubmit")}
        emptyLabel={t(locale, "audioEmpty")}
      />
    </div>
  );
}

function audioErrorKey(code: string | undefined) {
  switch (code) {
    case "type":
    case "empty":
      return "audioErrorType" as const;
    case "size":
      return "audioErrorSize" as const;
    case "consent":
      return "audioErrorConsent" as const;
    case "exists":
      return "audioErrorExists" as const;
    case "save":
      return "audioErrorSave" as const;
    default:
      return null;
  }
}

function pipeMessage(locale: ReturnType<typeof resolveLocale>, code: string | null | undefined) {
  const key = {
    transcription_failed: "pipeTranscriptionFailed",
    extraction_failed: "pipeExtractionFailed",
    extraction_invalid: "pipeExtractionFailed",
    generation_failed: "pipeGenerationFailed",
    audio_missing: "pipeAudioMissing",
    provider_unavailable: "pipeProvider",
    confirm: "pipeConfirm",
  }[code ?? ""] as MessageKey | undefined;
  return key ? t(locale, key) : null;
}

function ReviewBanner({
  locale,
  patientId,
  visitId,
  extraction,
  chart,
  previous,
}: {
  locale: ReturnType<typeof resolveLocale>;
  patientId: string;
  visitId: string;
  extraction: NonNullable<ReturnType<typeof parseStored>>;
  chart: Array<{ name: string; dose: string | null }>;
  previous: ReturnType<typeof parseStored>;
}) {
  const alerts = alertLines(locale, extraction, chart, previous);
  if (alerts.length === 0) return null;
  return (
    <section className="rounded-3xl bg-danger-soft px-4 py-4">
      <h2 className="text-sm font-semibold text-danger">
        {alerts.length} {t(locale, "alertsBefore")}
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {alerts.map((item) => (
          <li key={item} className="text-sm leading-6 text-danger">
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-3">
        <Link href={`/patients/${patientId}/visits/${visitId}?tab=analysis`} className="text-sm font-semibold text-accent">
          {t(locale, "backToAnalysis")}
        </Link>
        <Link href={`/patients/${patientId}/visits/${visitId}?tab=transcript`} className="text-sm font-semibold text-accent">
          {t(locale, "backToTranscript")}
        </Link>
      </div>
    </section>
  );
}

function AnalysisPanel({
  locale,
  visitId,
  patientId,
  extraction,
  previous,
  chart,
}: {
  locale: ReturnType<typeof resolveLocale>;
  visitId: string;
  patientId: string;
  extraction: NonNullable<ReturnType<typeof parseStored>>;
  previous: ReturnType<typeof parseStored>;
  chart: Array<{ name: string; dose: string | null }>;
}) {
  const risk = [...RISK_DOMAINS, "protectiveFactors" as const];
  const documented = (domain: FactDomain) => !isMissing(extraction.facts[domain]);
  const rows = (domains: readonly FactDomain[], includeMissing: boolean) =>
    domains.filter((domain) => includeMissing || documented(domain)).map((domain) => factRow(locale, patientId, visitId, domain, extraction.facts[domain]));

  const medRows = compareMedications(chart, extraction.medicationMentions).map((row) => ({
    ...row,
    label: t(
      locale,
      row.tone === "match"
        ? "medsMatch"
        : row.tone === "absent"
          ? "medsAbsent"
          : row.tone === "change"
            ? "medsDoseChange"
            : "medsUncertain",
    ),
  }));

  return (
    <AnalysisView
      alertsTitle={t(locale, "sectionAlerts")}
      alerts={alertLines(locale, extraction, chart, previous)}
      sections={[
        {
          id: "risk",
          title: t(locale, "sectionRisk"),
          open: true,
          empty: t(locale, "sectionEmpty"),
          rows: rows(risk, true),
        },
        {
          id: "clinical",
          title: t(locale, "sectionClinical"),
          open: true,
          empty: t(locale, "sectionEmpty"),
          rows: rows(CLINICAL_DOMAINS, false),
          folded: rows(CLINICAL_DOMAINS.filter((domain) => !documented(domain)), true),
          foldedTitle: t(locale, "sectionUndocumented"),
        },
        {
          id: "exam",
          title: t(locale, "sectionExam"),
          open: false,
          empty: t(locale, "sectionEmpty"),
          rows: rows(EXAM_DOMAINS, false),
          folded: rows(EXAM_DOMAINS.filter((domain) => !documented(domain)), true),
          foldedTitle: t(locale, "sectionUndocumented"),
        },
      ]}
      meds={{
        title: t(locale, "sectionMeds"),
        chartTitle: t(locale, "medsChart"),
        mentionedTitle: t(locale, "medsMentioned"),
        changesTitle: t(locale, "medsChanges"),
        emptyChart: t(locale, "medsEmpty"),
        emptyMentions: t(locale, "medsNone"),
        chart,
        rows: medRows,
      }}
      changes={{
        title: t(locale, "sectionChanges"),
        before: t(locale, "changeBefore"),
        today: t(locale, "changeToday"),
        empty: t(locale, "sectionEmpty"),
        notComparable: t(locale, "notComparable"),
        rows: comparisonRows(extraction, previous).map((delta) => ({
          id: delta.domain,
          label: t(locale, domainLabel(delta.domain)),
          from: t(locale, assertionKey(delta.from)),
          to: t(locale, assertionKey(delta.to)),
          historical: false,
          incomparable: delta.incomparable,
        })),
      }}
    />
  );
}

function factRow(
  locale: ReturnType<typeof resolveLocale>,
  patientId: string,
  visitId: string,
  domain: FactDomain,
  fact: ClinicalFact,
) {
  const quote = fact.evidence?.quote ?? null;
  const historical = fact.temporality === "historical" || fact.source !== "transcript";
  return {
    id: domain,
    label: t(locale, domainLabel(domain)),
    mark: factMark(fact),
    status: historical && !isMissing(fact) ? t(locale, "assertionHistorical") : t(locale, assertionKey(fact.assertion)),
    value: fact.value,
    quote,
    evidenceNote: evidenceNote(locale, fact),
    sourceHref: quote ? `/patients/${patientId}/visits/${visitId}?tab=transcript&src=${encodeURIComponent(quote)}` : null,
    sourceLabel: t(locale, "seeSource"),
    historical,
  };
}

function evidenceNote(locale: ReturnType<typeof resolveLocale>, fact: ClinicalFact) {
  if (fact.evidences.length === 0) return null;
  return fact.evidences
    .slice(0, 3)
    .map((item) => {
      const when = t(locale, TIME_KEYS[item.temporality]);
      const who = t(locale, SPEAKER_KEYS[item.speaker]);
      const extra = item.quote !== fact.evidence?.quote ? ` — ${item.quote}` : "";
      return `${who} · ${when}${extra}`;
    })
    .join(" · ");
}

function AnalysisExtras({
  locale,
  patientId,
  visitId,
  extraction,
}: {
  locale: ReturnType<typeof resolveLocale>;
  patientId: string;
  visitId: string;
  extraction: NonNullable<ReturnType<typeof parseStored>>;
}) {
  const evolution = Object.entries(extraction.longitudinal) as Array<[FactDomain, Evolution]>;
  const cards: Array<{ id: string; title: string; rows: string[] }> = [];
  if (evolution.length > 0) {
    cards.push({
      id: "evolution",
      title: t(locale, "sectionEvolution"),
      rows: evolution.map(([domain, value]) => `${t(locale, domainLabel(domain))} — ${t(locale, EVOLUTION_KEYS[value])}`),
    });
  }
  if (extraction.interventions.length > 0) {
    cards.push({ id: "interventions", title: t(locale, "sectionInterventions"), rows: extraction.interventions.map((item) => item.text) });
  }
  if (extraction.plan.length > 0) {
    cards.push({ id: "plan", title: t(locale, "sectionPlan"), rows: extraction.plan.map((item) => item.text) });
  }
  if (extraction.contradictions.length > 0) {
    cards.push({ id: "contradictions", title: t(locale, "sectionContradictions"), rows: extraction.contradictions.map((item) => item.summary) });
  }
  if (extraction.medicationDiscrepancies.length > 0) {
    cards.push({
      id: "discrepancies",
      title: t(locale, "sectionDiscrepancies"),
      rows: extraction.medicationDiscrepancies.map(
        (item) => `${item.medication}: ${item.recordDose ?? "—"} → ${item.reportedDose}. ${t(locale, "reviewNeeded")}`,
      ),
    });
  }
  if (extraction.pointsToVerify.length > 0) {
    cards.push({ id: "verify", title: t(locale, "sectionVerify"), rows: extraction.pointsToVerify });
  }

  if (cards.length === 0 && extraction.suggestedTasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => (
        <section key={card.id} className="rounded-3xl bg-card px-4 py-4 shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <h2 className="text-[15px] font-semibold text-ink">{card.title}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {card.rows.map((row) => (
              <li key={row} className="text-sm leading-6 text-ink">
                {row}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {extraction.suggestedTasks.length > 0 ? (
        <section className="rounded-3xl bg-card px-4 py-4 shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <h2 className="text-[15px] font-semibold text-ink">{t(locale, "sectionSuggestedTasks")}</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {extraction.suggestedTasks.map((task) => (
              <li key={task} className="flex flex-col gap-2">
                <p className="text-sm leading-6 text-ink">{task}</p>
                <form action={`/api/patients/${patientId}/tasks`} method="post">
                  <input type="hidden" name="visitId" value={visitId} />
                  <input type="hidden" name="next" value={`/patients/${patientId}/visits/${visitId}?tab=analysis`} />
                  <input type="hidden" name="title" value={task} />
                  <input type="hidden" name="priority" value="NORMAL" />
                  <button className="min-h-10 rounded-xl bg-terra px-3 text-sm font-semibold text-white">
                    {t(locale, "addSuggestedTask")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function alertLines(
  locale: ReturnType<typeof resolveLocale>,
  extraction: NonNullable<ReturnType<typeof parseStored>>,
  chart: Array<{ name: string; dose: string | null }>,
  previous: ReturnType<typeof parseStored>,
) {
  return reviewItems(extraction, chart, previous).map((item) => {
    const label = item.domain ? t(locale, domainLabel(item.domain)) : "";
    return label ? `${t(locale, REVIEW_KEYS[item.code])} — ${label}` : t(locale, REVIEW_KEYS[item.code]);
  });
}

function factMark(fact: ClinicalFact): "denied" | "present" | "missing" | "uncertain" {
  if (fact.assertion === "explicitly_denied") return "denied";
  if (fact.assertion === "present") return "present";
  if (fact.assertion === "uncertain") return "uncertain";
  return "missing";
}

function isMissing(fact: ClinicalFact) {
  return fact.assertion === "not_assessed" || fact.assertion === "not_reported";
}

function assertionKey(assertion: string): MessageKey {
  if (assertion === "explicitly_denied") return "assertionDenied";
  if (assertion === "present") return "assertionPresent";
  if (assertion === "uncertain") return "assertionUncertain";
  return "assertionMissing";
}

const DOMAIN_KEYS: Record<FactDomain, MessageKey> = {
  mood: "domainMood",
  affect: "domainAffect",
  anxiety: "domainAnxiety",
  sleep: "domainSleep",
  appetite: "domainAppetite",
  activity: "domainActivity",
  functioning: "domainFunctioning",
  work: "domainWork",
  family: "domainFamily",
  isolation: "domainIsolation",
  speech: "domainSpeech",
  thought: "domainThought",
  thoughtContent: "domainThoughtContent",
  delusions: "domainDelusions",
  hallucinations: "domainHallucinations",
  psychosis: "domainPsychosis",
  agitation: "domainAgitation",
  retardation: "domainRetardation",
  impulsivity: "domainImpulsivity",
  behavior: "domainBehavior",
  insight: "domainInsight",
  judgment: "domainJudgment",
  adherence: "domainAdherence",
  sideEffects: "domainSideEffects",
  substanceUse: "domainSubstanceUse",
  suicidality: "domainSuicidality",
  suicideIntent: "domainSuicideIntent",
  suicidePlan: "domainSuicidePlan",
  recentSuicidalBehavior: "domainRecentSuicidal",
  selfHarm: "domainSelfHarm",
  aggression: "domainAggression",
  dangerousness: "domainDangerousness",
  protectiveFactors: "domainProtective",
};

function domainLabel(domain: string): MessageKey {
  return DOMAIN_KEYS[domain as FactDomain] ?? "badgeMissing";
}

const EVOLUTION_KEYS: Record<Evolution, MessageKey> = {
  improved: "evolutionImproved",
  worsened: "evolutionWorsened",
  stable: "evolutionStable",
  new: "evolutionNew",
  resolved: "evolutionResolved",
  unclear: "evolutionUnclear",
  not_reassessed: "evolutionNotReassessed",
};

const SPEAKER_KEYS: Record<Speaker, MessageKey> = {
  PATIENT: "speakerPatient",
  FAMILY: "speakerFamily",
  NURSE: "speakerNurse",
  OTHER_CLINICIAN: "speakerOther",
  UNKNOWN: "speakerUnknown",
};

const TIME_KEYS: Record<EvidenceTime, MessageKey> = {
  CURRENT: "timeCurrent",
  RECENT_PAST: "timeRecent",
  HISTORICAL: "timeHistorical",
  UNCLEAR: "timeUnclear",
};

const REVIEW_KEYS: Record<ReviewItemCode, MessageKey> = {
  risk_missing: "flagRiskMissing",
  suicide_present: "flagSuicideMentioned",
  suicide_uncertain: "flagSuicideUncertain",
  dose_uncertain: "flagDose",
  med_absent: "flagMedMissing",
  dose_change: "flagDoseChange",
  chart_quiet: "flagChartQuiet",
  contradiction: "flagContradiction",
  downgraded: "flagDowngraded",
  uncertain_fact: "flagUncertainFact",
  gap: "flagGap",
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
