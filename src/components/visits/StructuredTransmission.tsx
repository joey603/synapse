"use client";

import { useEffect, useState } from "react";
import type { DrivingRiskStatus } from "@prisma/client";

import { BidiRichText } from "@/components/ui/BidiRichText";
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
    regenerate: string;
    shorten: string;
    moreClinical: string;
    correctHebrew: string;
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
  const fieldClass = `min-h-40 w-full rounded-2xl bg-field px-3 py-3 text-base leading-7 text-ink outline-none ${BIDI_TEXT_CLASS}`;
  const fullClass = `min-h-56 w-full rounded-3xl bg-field px-4 py-4 text-base leading-7 text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)] outline-none ${BIDI_TEXT_CLASS}`;

  useEffect(() => {
    setText(initialText);
    setStructured(initialStructured);
    setDuration(initialDurationMinutes);
  }, [initialText, initialDurationMinutes, structuredKey, initialStructured]);

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
    // initialStructured is synced via structuredKey above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, structured, duration, validated, visitId, initialText, initialDurationMinutes]);

  async function persist(payload: {
    text: string;
    structured: StructuredFields;
    durationMinutes: number | null;
  }) {
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
  }

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
    <div className="flex flex-col gap-4">
      {validated ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            {labels.validatedBadge}
          </span>
          {validatedAtLabel ? <span className="text-sm text-muted">{validatedAtLabel}</span> : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted">{labels.help}</p>
      )}

      <SurfaceCard className="flex flex-col gap-2.5 p-4">
        <h2 className="text-sm font-semibold text-ink">{labels.visitInfo}</h2>
        <MetaRow label={labels.visitType} value={visitMeta.typeLabel} />
        <MetaRow label={labels.author} value={visitMeta.authorName} />
        <MetaRow label={labels.date} value={visitMeta.dateLabel} />
        <MetaRow label={labels.time} value={visitMeta.timeLabel} />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted">{labels.duration}</p>
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
                    className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${
                      duration === preset ? "bg-accent text-white" : "bg-surface text-ink"
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
                className="min-h-11 w-28 rounded-2xl border border-line/80 bg-field px-3 text-base outline-none"
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
            onChange={(value) => updateField("patientStatusNote", value)}
          />

          <SurfaceCard className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold text-ink">{labels.drivingRisk}</h2>
            {validated ? (
              <p className="text-sm text-ink">{labels.drivingLabels[structured.drivingRisk]}</p>
            ) : (
              <select
                value={structured.drivingRisk}
                onChange={(event) => updateField("drivingRisk", event.target.value as DrivingRiskStatus)}
                className="min-h-11 rounded-2xl border border-line/80 bg-field px-3 text-sm outline-none"
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

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{labels.fullTransmission}</h2>
        {validated ? (
          <BidiRichText text={text} className={fullClass} />
        ) : (
          <textarea
            dir={direction}
            lang={direction === "rtl" ? "he" : "fr"}
            value={wrapRtlIsolates(text)}
            onChange={(event) => setText(stripBidiMarks(event.target.value))}
            className={fullClass}
          />
        )}
      </div>

      {note ? <p className="text-sm text-muted">{note}</p> : null}

      {validated ? null : (
        <div className="flex flex-col gap-2">
          <form action={`/api/visits/${visitId}/report/validate`} method="post">
            <button type="submit" className="min-h-12 w-full rounded-2xl bg-card text-sm font-semibold text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
              {labels.validate}
            </button>
          </form>
        </div>
      )}

      {validated ? null : (
        <div className="flex flex-col gap-2">
          <ActionForm visitId={visitId} action="regenerate" label={labels.regenerate} />
          <ActionForm visitId={visitId} action="shorten" label={labels.shorten} />
          <ActionForm visitId={visitId} action="more_clinical" label={labels.moreClinical} />
          <ActionForm visitId={visitId} action="correct_hebrew" label={labels.correctHebrew} />
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
    <SurfaceCard className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {onCopy && value.trim() ? (
          <button type="button" onClick={onCopy} className="text-xs font-semibold text-accent">
            {copied ? copiedLabel : copyLabel}
          </button>
        ) : null}
      </div>
      {showEmpty ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : locked ? (
        <BidiRichText text={value} className={`text-sm leading-6 text-ink ${BIDI_TEXT_CLASS}`} />
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

function ActionForm({ visitId, action, label }: { visitId: string; action: string; label: string }) {
  return (
    <form action={`/api/visits/${visitId}/report/actions`} method="post">
      <input type="hidden" name="action" value={action} />
      <ActionButton label={label} />
    </form>
  );
}

function ActionButton({ label }: { label: string }) {
  return (
    <button type="submit" className="min-h-11 w-full rounded-2xl bg-surface text-sm font-semibold text-ink">
      {label}
    </button>
  );
}
