"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const BUSY = new Set(["TRANSCRIBING", "EXTRACTING", "GENERATING"]);

type StepId = "upload" | "transcribe" | "extract" | "report";
type StepState = "pending" | "active" | "done" | "failed";

export function PipelineProgress({
  visitId,
  status,
  failureCode = null,
  labels,
  polling,
  workingLabel,
  failedLabel,
}: {
  visitId: string;
  status: string;
  failureCode?: string | null;
  labels: [string, string, string, string];
  polling: boolean;
  workingLabel: string;
  failedLabel: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [failedAt, setFailedAt] = useState<StepId | null>(() =>
    status === "FAILED" ? stepForFailure(failureCode) : null,
  );
  const [seenStatus, setSeenStatus] = useState(status);

  if (seenStatus !== status) {
    setSeenStatus(status);
    setCurrent(status);
    if (status === "FAILED") setFailedAt(stepForFailure(failureCode));
    else setFailedAt(null);
  }

  useEffect(() => {
    if (current === "READY" || current === "FAILED") return;
    if (!polling && !BUSY.has(current)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/visits/${visitId}/pipeline`);
      if (!response.ok) return;
      const data = (await response.json()) as { pipelineStatus?: string; failureCode?: string | null };
      if (!data.pipelineStatus || data.pipelineStatus === current) return;
      if (data.pipelineStatus === "FAILED") {
        setFailedAt(stepForFailure(data.failureCode) ?? busyStep(current) ?? "extract");
      }
      setCurrent(data.pipelineStatus);
      router.refresh();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [current, polling, router, visitId]);

  const steps: Array<{ id: StepId; label: string; state: StepState }> = [
    { id: "upload", label: labels[0], state: stepState(current, "upload", failedAt) },
    { id: "transcribe", label: labels[1], state: stepState(current, "transcribe", failedAt) },
    { id: "extract", label: labels[2], state: stepState(current, "extract", failedAt) },
    { id: "report", label: labels[3], state: stepState(current, "report", failedAt) },
  ];

  const active = steps.find((step) => step.state === "active");
  const failed = steps.find((step) => step.state === "failed");
  const busy = Boolean(active);
  const progress = progressPercent(current);

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {busy || failed ? (
        <div
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
            failed ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"
          }`}
          role="status"
        >
          {failed ? <FailedMark /> : <Spinner className="text-accent" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{failed ? failedLabel : workingLabel}</p>
            <p className="truncate text-sm opacity-90">{(failed ?? active)?.label}</p>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <StepIcon state={step.state} />
            <span
              className={
                step.state === "done"
                  ? "font-medium text-ink"
                  : step.state === "active"
                    ? "font-semibold text-accent"
                    : step.state === "failed"
                      ? "font-semibold text-danger"
                      : "text-muted"
              }
            >
              {step.label}
              {step.state === "active" ? "…" : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function stepState(status: string, id: StepId, failedAt: StepId | null): StepState {
  if (status === "FAILED") {
    if (failedAt === id) return "failed";
    if (failedAt && orderOf(id) < orderOf(failedAt)) return "done";
    return "pending";
  }
  if (busyStep(status) === id) return "active";
  if (isDone(status, id)) return "done";
  return "pending";
}

function busyStep(status: string): StepId | null {
  if (status === "TRANSCRIBING") return "transcribe";
  if (status === "EXTRACTING") return "extract";
  if (status === "GENERATING") return "report";
  return null;
}

function stepForFailure(code: string | null | undefined): StepId {
  switch (code) {
    case "audio_missing":
    case "transcription_failed":
    case "provider_unavailable":
      return "transcribe";
    case "unrelated_content":
    case "extraction_failed":
      return "extract";
    case "generation_failed":
      return "report";
    default:
      return "extract";
  }
}

function isDone(status: string, id: StepId) {
  const order = [
    "IDLE",
    "UPLOADED",
    "TRANSCRIBING",
    "TRANSCRIBED",
    "EXTRACTING",
    "EXTRACTED",
    "GENERATING",
    "READY",
  ];
  const marker =
    id === "upload"
      ? "UPLOADED"
      : id === "transcribe"
        ? "TRANSCRIBED"
        : id === "extract"
          ? "EXTRACTED"
          : "READY";
  return order.indexOf(status) >= order.indexOf(marker);
}

function orderOf(id: StepId) {
  return { upload: 0, transcribe: 1, extract: 2, report: 3 }[id];
}

function progressPercent(status: string) {
  const map: Record<string, number> = {
    IDLE: 0,
    UPLOADED: 10,
    TRANSCRIBING: 30,
    TRANSCRIBED: 45,
    EXTRACTING: 65,
    EXTRACTED: 80,
    GENERATING: 92,
    READY: 100,
    FAILED: 100,
  };
  return map[status] ?? 8;
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <DoneMark />;
  if (state === "active") return <Spinner className="text-accent" />;
  if (state === "failed") return <FailedMark />;
  return (
    <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-full bg-line" />
    </span>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V1C5.373 1 1 5.373 1 12h3zm2 5.291A7.962 7.962 0 014 12H1c0 3.042 1.135 5.824 3 7.938l2-1.647z"
        />
      </svg>
    </span>
  );
}

function DoneMark() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white"
      aria-hidden
    >
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6.2 4.8 8.5 9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FailedMark() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger text-white"
      aria-hidden
    >
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
