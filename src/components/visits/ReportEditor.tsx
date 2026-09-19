"use client";

import { useCallback, useEffect, useState } from "react";

import { BidiRichText } from "@/components/ui/BidiRichText";
import { BIDI_TEXT_CLASS, stripBidiMarks, textDirection, wrapRtlIsolates } from "@/lib/i18n/text-direction";

export function ReportEditor({
  visitId,
  initialText,
  validated,
  status,
  validatedAtLabel,
  labels,
}: {
  visitId: string;
  initialText: string;
  validated: boolean;
  status: string;
  validatedAtLabel?: string | null;
  labels: {
    copy: string;
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
  };
}) {
  const [text, setText] = useState(initialText);
  const [note, setNote] = useState("");
  const direction = textDirection(text);
  const fieldClass = `min-h-72 w-full rounded-3xl bg-field px-4 py-4 text-base leading-7 text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)] outline-none ${BIDI_TEXT_CLASS}`;
  const [seenInitialText, setSeenInitialText] = useState(initialText);

  if (seenInitialText !== initialText) {
    setSeenInitialText(initialText);
    setText(initialText);
  }

  const save = useCallback(
    async (value: string) => {
      try {
        const response = await fetch(`/api/visits/${visitId}/report`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: stripBidiMarks(value) }),
        });
        setNote(response.ok ? labels.saved : labels.lost);
      } catch {
        setNote(labels.lost);
      }
    },
    [visitId, labels.saved, labels.lost],
  );

  useEffect(() => {
    if (validated || text === initialText) return;
    const timer = window.setTimeout(() => {
      void save(text);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [initialText, text, validated, save]);

  async function copy() {
    if (!validated && !window.confirm(labels.copyWarn)) return;
    const value = stripBidiMarks(text).trim();
    if (!value) return;
    await navigator.clipboard.writeText(value);
    await fetch(`/api/visits/${visitId}/report/copy`, { method: "POST" });
  }

  return (
    <div className="flex flex-col gap-3">
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
      {validated ? (
        <BidiRichText text={text} className={fieldClass} />
      ) : (
        <textarea
          dir={direction}
          lang={direction === "rtl" ? "he" : "fr"}
          value={wrapRtlIsolates(text)}
          onChange={(event) => setText(stripBidiMarks(event.target.value))}
          onBlur={() => {
            if (text !== initialText) void save(text);
          }}
          className={fieldClass}
        />
      )}
      {note ? <p className="text-sm text-muted">{note}</p> : null}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => void copy()} className="min-h-12 rounded-2xl bg-accent text-sm font-semibold text-white">
          {labels.copy}
        </button>
        {validated ? null : (
          <form action={`/api/visits/${visitId}/report/validate`} method="post">
            <button type="submit" className="min-h-12 w-full rounded-2xl bg-card text-sm font-semibold text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
              {labels.validate}
            </button>
          </form>
        )}
      </div>
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
