"use client";

import { useEffect, useState } from "react";

export function ReportEditor({
  visitId,
  initialText,
  validated,
  status,
  labels,
}: {
  visitId: string;
  initialText: string;
  validated: boolean;
  status: string;
  labels: {
    copy: string;
    copyWarn: string;
    validate: string;
    regenerate: string;
    shorten: string;
    moreClinical: string;
    correctHebrew: string;
    confirmOverwrite: string;
    saved: string;
    lost: string;
    help: string;
    confirmNeeded: boolean;
  };
}) {
  const [text, setText] = useState(initialText);
  const [note, setNote] = useState("");

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (validated || text === initialText) return;
    const timer = window.setTimeout(() => {
      void save(text);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [initialText, text, validated, visitId]);

  async function save(value: string) {
    try {
      const response = await fetch(`/api/visits/${visitId}/report`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      setNote(response.ok ? labels.saved : labels.lost);
    } catch {
      setNote(labels.lost);
    }
  }

  async function copy() {
    if (!validated && !window.confirm(labels.copyWarn)) return;
    const value = text.trim();
    if (!value) return;
    await navigator.clipboard.writeText(value);
    await fetch(`/api/visits/${visitId}/report/copy`, { method: "POST" });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-muted">{labels.help}</p>
      <textarea
        dir="rtl"
        value={text}
        readOnly={validated}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (!validated && text !== initialText) void save(text);
        }}
        className="min-h-72 w-full rounded-3xl bg-card px-4 py-4 text-base leading-7 text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)] outline-none"
      />
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
          {labels.confirmNeeded ? (
            <form action={`/api/visits/${visitId}/report/actions`} method="post" className="flex flex-col gap-2">
              <input type="hidden" name="action" value="regenerate" />
              <label className="flex items-start gap-3 text-sm leading-6 text-ink">
                <input type="checkbox" name="confirm" required className="mt-1 h-4 w-4 accent-accent" />
                {labels.confirmOverwrite}
              </label>
              <ActionButton label={labels.regenerate} />
            </form>
          ) : (
            <ActionForm visitId={visitId} action="regenerate" label={labels.regenerate} />
          )}
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
