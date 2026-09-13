import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AudioUploader } from "@/components/visits/AudioUploader";
import { LiveRecorder } from "@/components/visits/LiveRecorder";
import { PipelineProgress } from "@/components/visits/PipelineProgress";
import { ReportEditor } from "@/components/visits/ReportEditor";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { parseStored } from "@/lib/clinical/schema";
import type { ReviewFlagCode } from "@/lib/clinical/types";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; visitId: string }>;
  searchParams: Promise<{ audio?: string; tab?: string; run?: string; pipe?: string }>;
}) {
  const { id, visitId } = await params;
  const { audio, tab = "transcript", run, pipe } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const visit = await db.visit.findFirst({
    where: { id: visitId, patientId: id },
    include: { patient: true, report: true, recording: true, transcript: true, extraction: true },
  });
  if (!visit) notFound();

  const status = visit.report?.status ?? "DRAFT";
  const statusLabel =
    status === "AI_GENERATED" || status === "REVIEWED"
      ? t(locale, "reportPending")
      : status === "VALIDATED"
        ? t(locale, "reportValidated")
        : t(locale, "visitDraft");

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/patients/${id}?tab=timeline`} className="inline-flex min-h-10 items-center text-sm font-medium text-muted">
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
          {visit.pipelineStatus !== "READY" && !["TRANSCRIBING", "EXTRACTING", "GENERATING"].includes(visit.pipelineStatus) ? (
            <form action={`/api/visits/${visit.id}/pipeline`} method="post">
              <button type="submit" className="min-h-12 w-full rounded-2xl bg-accent text-sm font-semibold text-white">
                {visit.pipelineStatus === "FAILED" ? t(locale, "retryPipeline") : t(locale, "startPipeline")}
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
            <Analysis locale={locale} payload={visit.extraction?.payload} />
          ) : tab === "report" && visit.report?.editedDraft ? (
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
          ) : tab === "report" ? (
            <p className="text-sm text-muted">{t(locale, "analysisEmpty")}</p>
          ) : (
            <SurfaceCard className="p-4">
              <p className="text-xs font-medium text-muted">{t(locale, "transcriptNote")}</p>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-ink">{visit.transcript.rawText}</p>
            </SurfaceCard>
          )}
        </>
      ) : null}
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
        <form action={`/api/recordings/${stored.id}`} method="post" className="flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm leading-6 text-ink">
            <input type="checkbox" name="confirmDelete" className="mt-1 h-4 w-4 accent-accent" required />
            {t(locale, "audioDeleteConfirm")}
          </label>
          <button type="submit" className="min-h-12 rounded-2xl bg-danger-soft text-sm font-semibold text-danger">
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
    case "confirm":
      return "audioErrorConfirm" as const;
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

function Analysis({ locale, payload }: { locale: ReturnType<typeof resolveLocale>; payload: unknown }) {
  const extraction = parseStored(payload);
  if (!extraction) return <p className="text-sm text-muted">{t(locale, "analysisEmpty")}</p>;

  const flags = extraction.reviewFlags.map((flag) => t(locale, FLAG_KEYS[flag.code])).filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {flags.length > 0 ? (
        <SurfaceCard>
          {flags.map((flag) => (
            <p key={flag} className="border-t border-line/70 px-4 py-3 text-sm leading-6 text-ink first:border-t-0">
              {flag}
            </p>
          ))}
        </SurfaceCard>
      ) : null}
      <SurfaceCard>
        {Object.entries(extraction.facts).map(([domain, fact]) => (
          <div key={domain} className="border-t border-line/70 px-4 py-3 first:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{domain}</p>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                {t(locale, badgeKey(fact.assertion, fact.temporality))}
              </span>
            </div>
            {fact.evidence?.quote ? <p className="mt-1 text-sm leading-6 text-muted">{fact.evidence.quote}</p> : null}
          </div>
        ))}
      </SurfaceCard>
    </div>
  );
}

function badgeKey(assertion: string, temporality: string): MessageKey {
  if (assertion === "uncertain") return "badgeUncertain";
  if (assertion === "not_assessed" || assertion === "not_reported") return "badgeMissing";
  if (temporality === "historical") return "badgeHistorical";
  return "badgeCurrent";
}

const FLAG_KEYS: Record<ReviewFlagCode, MessageKey> = {
  suicide_mentioned: "flagSuicideMentioned",
  suicide_uncertain: "flagSuicideUncertain",
  dose_uncertain: "flagDose",
  medication_not_in_chart: "flagMedMissing",
  chart_medication_not_mentioned: "flagChartQuiet",
  contradiction: "flagContradiction",
  downgraded: "flagDowngraded",
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
