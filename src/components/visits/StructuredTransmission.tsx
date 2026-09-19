"use client";

import { useCallback, useEffect, useState } from "react";
import type { DrivingRiskStatus } from "@prisma/client";

import { BidiRichText } from "@/components/ui/BidiRichText";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { BIDI_TEXT_CLASS, stripBidiMarks, textDirection, wrapRtlIsolates } from "@/lib/i18n/text-direction";

const DURATION_PRESETS = [20, 30, 45, 60] as const;

const DRIVING_OPTIONS: DrivingRiskStatus[] = [
  "NOT_ASSESSED",
  "NO_RISK_IDENTIFIED",
  "POSSIBLE_RISK",
  "RISK_IDENTIFIED",
  "UNCLEAR",
];

type StructuredFields = {
  patientStatusNote: string;
  drivingRisk: DrivingRiskStatus;
  diagnosisNote: string;
  mainProblems: string;
  currentMedication: string;
  interventionsProvided: string;
  carePlan: string;
};

export function StructuredTransmission({
  visitId,
  validated,
  status,
  initialText,
  validatedAtLabel,
  visitMeta,
  initialStructured,
  initialDurationMinutes,
  labels,
}: {
  visitId: string;
  validated: boolean;
  status: string;
  initialText: string;
  validatedAtLabel?: string | null;
  visitMeta: {
    typeLabel: string;
    authorName: string;
    dateLabel: string;
    timeLabel: string;
  };
  initialStructured: StructuredFields;
  initialDurationMinutes: number | null;
  labels: {
    copy: string;
    copyBlock: string;
    copied: string;
    copyWarn: string;
    validate: string;
    saved: string;
    lost: string;
    help: string;
    validatedBadge: string;
    visitInfo: string;
    visitType: string;
    author: string;
    date: string;
    time: string;
    duration: string;
    durationUnit: string;
    patientStatus: string;
    drivingRisk: string;
    diagnosis: string;
    mainProblems: string;
    currentMedication: string;
    interventions: string;
    carePlan: string;
    fullTransmission: string;
    emptySection: string;
    drivingLabels: Record<DrivingRiskStatus, string>;
  };
}) {
  const [text, setText] = useState(initialText);
  const [structured, setStructured] = useState(initialStructured);
  const [duration, setDuration] = useState<number | null>(initialDurationMinutes);
  const [note, setNote] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const direction = textDirection(text);
  const structuredKey = [
    initialStructured.patientStatusNote,
    initialStructured.drivingRisk,
    initialStructured.diagnosisNote,
    initialStructured.mainProblems,
    initialStructured.currentMedication,
    initialStructured.interventionsProvided,
    initialStructured.carePlan,
  ].join("\u0001");
  const fieldClass = `min-h-36 w-full synapse-field synapse-clinical-text px-3 py-3 ${BIDI_TEXT_CLASS}`;
  const fullClass = `min-h-64 w-full rounded-synapse-lg border border-line/60 bg-card px-4 py-4 synapse-document-text text-ink shadow-none outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 ${BIDI_TEXT_CLASS}`;

  const incomingKey = `${structuredKey}\u0000${initialText}\u0000${String(initialDurationMinutes)}`;
  const [propsKey, setPropsKey] = useState(incomingKey);
  if (propsKey !== incomingKey) {
    setPropsKey(incomingKey);
    setText(initialText);
    setStructured(initialStructured);
    setDuration(initialDurationMinutes);
  }

  const persist = useCallback(
    async (payload: {
      text: string;
      structured: StructuredFields;
      durationMinutes: number | null;
    }) => {
      try {
        const response = await fetch(`/api/visits/${visitId}/report`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: stripBidiMarks(payload.text),
            durationMinutes: payload.durationMinutes,
            patientStatusNote: payload.structured.patientStatusNote || null,
            drivingRisk: payload.structured.drivingRisk,
            diagnosisNote: payload.structured.diagnosisNote || null,
            mainProblems: payload.structured.mainProblems || null,
            currentMedication: payload.structured.currentMedication || null,
            interventionsProvided: payload.structured.interventionsProvided || null,
            carePlan: payload.structured.carePlan || null,
          }),
        });
        setNote(response.ok ? labels.saved : labels.lost);
      } catch {
        setNote(labels.lost);
      }
    },
    [visitId, labels.saved, labels.lost],
  );

  useEffect(() => {
    if (validated) return;
    const unchanged =
      text === initialText &&
      duration === initialDurationMinutes &&
      structured.patientStatusNote === initialStructured.patientStatusNote &&
      structured.drivingRisk === initialStructured.drivingRisk &&
      structured.diagnosisNote === initialStructured.diagnosisNote &&
      structured.mainProblems === initialStructured.mainProblems &&
      structured.currentMedication === initialStructured.currentMedication &&
      structured.interventionsProvided === initialStructured.interventionsProvided &&
      structured.carePlan === initialStructured.carePlan;
    if (unchanged) return;
    const timer = window.setTimeout(() => {
      void persist({ text, structured, durationMinutes: duration });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    text,
    structured,
    duration,
    validated,
    visitId,
    initialText,
    initialDurationMinutes,
    initialStructured,
    persist,
  ]);

  async function copyBlock(key: string, value: string) {
    try {
      const clean = value.trim();
      if (!clean) return;
      await navigator.clipboard.writeText(clean);
      flashCopied(key);
    } catch {
      setNote(labels.lost);
    }
  }

  function flashCopied(key: string) {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
  }

  function updateField<K extends keyof StructuredFields>(key: K, value: StructuredFields[K]) {
    setStructured((prev) => ({ ...prev, [key]: value }));
  }

  // Toujours afficher les sections structurées (legacy VALIDATED inclus) :
  // un champ vide → « Non renseigné », pas masquer tout le bloc.

  return (
    <div className="flex flex-col gap-3.5">
      {validated ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="success">{labels.validatedBadge}</StatusBadge>
          {validatedAtLabel ? <span className="text-[13px] text-muted">{validatedAtLabel}</span> : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted">{labels.help}</p>
      )}

      <SurfaceCard variant="secondary" className="flex flex-col gap-2.5 p-4">
        <h2 className="text-[15px] font-semibold text-ink">{labels.visitInfo}</h2>
        <MetaRow label={labels.visitType} value={visitMeta.typeLabel} />
        <MetaRow label={labels.author} value={visitMeta.authorName} />
        <MetaRow label={labels.date} value={visitMeta.dateLabel} />
        <MetaRow label={labels.time} value={visitMeta.timeLabel} />
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-muted">{labels.duration}</p>
          {validated ? (
            <p className="text-sm text-ink">
              {duration != null ? `${duration} ${labels.durationUnit}` : "—"}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(preset)}
                    className={`min-h-10 rounded-synapse-sm px-3 text-sm font-semibold synapse-transition ${
                      duration === preset ? "bg-accent text-white" : "bg-surface text-ink ring-1 ring-line/80"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={480}
                value={duration ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    setDuration(null);
                    return;
                  }
                  const n = Number(raw);
                  if (Number.isInteger(n)) setDuration(n);
                }}
                className="min-h-11 w-28 synapse-field px-3 text-base"
              />
            </>
          )}
        </div>
      </SurfaceCard>

      <>
          <Section
            title={labels.patientStatus}
            value={structured.patientStatusNote}
            empty={labels.emptySection}
            locked={validated}
            fieldClass={fieldClass}
            copyLabel={labels.copyBlock}
            copied={copiedKey === "patientStatus"}
            copiedLabel={labels.copied}
            onCopy={() => void copyBlock("patientStatus", structured.patientStatusNote)}
            onChange={(value) => updateField("patientStatusNote", value)}
          />

          <SurfaceCard variant="inner" className="flex flex-col gap-2 p-3.5">
            <h2 className="text-[15px] font-semibold text-ink">{labels.drivingRisk}</h2>
            {validated ? (
              <p className="synapse-clinical-text text-ink">{labels.drivingLabels[structured.drivingRisk]}</p>
            ) : (
              <select
                value={structured.drivingRisk}
                onChange={(event) => updateField("drivingRisk", event.target.value as DrivingRiskStatus)}
                className="min-h-11 synapse-field px-3 text-sm"
              >
                {DRIVING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {labels.drivingLabels[option]}
                  </option>
                ))}
              </select>
            )}
          </SurfaceCard>

          <Section
            title={labels.diagnosis}
            value={structured.diagnosisNote}
            empty={labels.emptySection}
            locked={validated}
            fieldClass={fieldClass}
            onChange={(value) => updateField("diagnosisNote", value)}
          />

          <Section
            title={labels.mainProblems}
            value={structured.mainProblems}
            empty={labels.emptySection}
            locked={validated}
            fieldClass={fieldClass}
            copyLabel={labels.copyBlock}
            copied={copiedKey === "mainProblems"}
            copiedLabel={labels.copied}
            onCopy={() => void copyBlock("mainProblems", structured.mainProblems)}
            onChange={(value) => updateField("mainProblems", value)}
          />

          <Section
            title={labels.currentMedication}
            value={structured.currentMedication}
            empty={labels.emptySection}
            locked={validated}
            fieldClass={fieldClass}
            copyLabel={labels.copyBlock}
            copied={copiedKey === "currentMedication"}
            copiedLabel={labels.copied}
            onCopy={() => void copyBlock("currentMedication", structured.currentMedication)}
            onChange={(value) => updateField("currentMedication", value)}
          />

          <Section
            title={labels.interventions}
            value={structured.interventionsProvided}
            empty={labels.emptySection}
            locked={validated}
            fieldClass={fieldClass}
            copyLabel={labels.copyBlock}
            copied={copiedKey === "interventions"}
            copiedLabel={labels.copied}
            onCopy={() => void copyBlock("interventions", structured.interventionsProvided)}
            onChange={(value) => updateField("interventionsProvided", value)}
          />

          <Section
            title={labels.carePlan}
            value={structured.carePlan}
            empty={labels.emptySection}
            locked={validated}
            fieldClass={fieldClass}
            copyLabel={labels.copyBlock}
            copied={copiedKey === "carePlan"}
            copiedLabel={labels.copied}
            onCopy={() => void copyBlock("carePlan", structured.carePlan)}
            onChange={(value) => updateField("carePlan", value)}
          />
      </>

      <SurfaceCard variant="primary" className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">{labels.fullTransmission}</h2>
          {text.trim() ? (
            <button
              type="button"
              onClick={() => void copyBlock("full", text)}
              className="rounded-synapse-sm px-2.5 py-1.5 text-xs font-semibold text-accent synapse-transition hover:bg-accent-soft"
            >
              {copiedKey === "full" ? labels.copied : labels.copy}
            </button>
          ) : null}
        </div>
        {validated ? (
          <div className="rounded-synapse-md bg-surface/70 px-1 py-1">
            <BidiRichText text={text} className={`px-3 py-3 synapse-document-text text-ink ${BIDI_TEXT_CLASS}`} />
          </div>
        ) : (
          <textarea
            dir={direction}
            lang={direction === "rtl" ? "he" : "fr"}
            value={wrapRtlIsolates(text)}
            onChange={(event) => setText(stripBidiMarks(event.target.value))}
            className={fullClass}
          />
        )}
      </SurfaceCard>

      {note ? <p className="text-[13px] text-muted">{note}</p> : null}

      {validated ? null : (
        <div className="flex flex-col gap-2 pt-1">
          <form action={`/api/visits/${visitId}/report/validate`} method="post">
            <Button type="submit">{labels.validate}</Button>
          </form>
        </div>
      )}
      <p className="sr-only">{status}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-end font-medium text-ink">{value}</span>
    </p>
  );
}

function Section({
  title,
  value,
  empty,
  locked,
  fieldClass,
  copyLabel,
  copied,
  copiedLabel,
  onCopy,
  onChange,
}: {
  title: string;
  value: string;
  empty: string;
  locked: boolean;
  fieldClass: string;
  copyLabel?: string;
  copied?: boolean;
  copiedLabel?: string;
  onCopy?: () => void;
  onChange: (value: string) => void;
}) {
  const showEmpty = locked && !value.trim();
  return (
    <SurfaceCard variant="inner" className="flex flex-col gap-2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {onCopy && value.trim() ? (
          <button
            type="button"
            onClick={onCopy}
            className="text-xs font-semibold text-accent synapse-transition"
          >
            {copied ? copiedLabel : copyLabel}
          </button>
        ) : null}
      </div>
      {showEmpty ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : locked ? (
        <BidiRichText text={value} className={`synapse-clinical-text text-ink ${BIDI_TEXT_CLASS}`} />
      ) : (
        <textarea
          dir={textDirection(value)}
          value={wrapRtlIsolates(value)}
          onChange={(event) => onChange(stripBidiMarks(event.target.value))}
          className={fieldClass}
        />
      )}
    </SurfaceCard>
  );
}
