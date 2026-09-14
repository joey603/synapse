"use client";

import { useEffect, useState } from "react";

export function TranscriptEditor({
  visitId,
  initialText,
  originalText,
  locked,
  edited,
  highlight,
  labels,
}: {
  visitId: string;
  initialText: string;
  originalText?: string | null;
  locked: boolean;
  edited: boolean;
  highlight?: string;
  labels: {
    raw: string;
    edited: string;
    note: string;
    saving: string;
    saved: string;
    lost: string;
    source: string;
    original: string;
    corrected: string;
  };
}) {
  const [text, setText] = useState(initialText);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"corrected" | "original">("corrected");
  const canCompare = Boolean(originalText && originalText !== initialText);

  useEffect(() => {
    if (locked || text === initialText) return;
    const timer = window.setTimeout(() => {
      void persist(text);
    }, 700);
    return () => window.clearTimeout(timer);

    async function persist(value: string) {
      setSaving(true);
      setNote(labels.saving);
      try {
        const response = await fetch(`/api/visits/${visitId}/transcript`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        });
        setNote(response.ok ? labels.saved : labels.lost);
      } catch {
        setNote(labels.lost);
      } finally {
        setSaving(false);
      }
    }
  }, [initialText, labels.lost, labels.saved, labels.saving, locked, text, visitId]);

  async function save(value: string) {
    setSaving(true);
    setNote(labels.saving);
    try {
      const response = await fetch(`/api/visits/${visitId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      setNote(response.ok ? labels.saved : labels.lost);
    } catch {
      setNote(labels.lost);
    } finally {
      setSaving(false);
    }
  }

  const showingOriginal = view === "original" && canCompare;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">
          {showingOriginal ? labels.original : edited ? labels.edited : labels.raw}
        </p>
        {canCompare ? (
          <button
            type="button"
            onClick={() => setView(view === "original" ? "corrected" : "original")}
            className="text-xs font-semibold text-accent"
          >
            {view === "original" ? labels.corrected : labels.original}
          </button>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-muted">{labels.note}</p>
      {highlight && !showingOriginal ? (
        <p className="rounded-2xl bg-field px-4 py-3 text-sm leading-6 text-ink">
          <span className="block text-xs font-semibold text-accent">{labels.source}</span>
          <mark className="bg-transparent font-medium text-ink">{highlight}</mark>
        </p>
      ) : null}
      <textarea
        value={showingOriginal ? originalText ?? "" : text}
        readOnly={locked || showingOriginal}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (!locked && !showingOriginal && text !== initialText) void save(text);
        }}
        className="min-h-72 w-full rounded-3xl bg-field px-4 py-4 text-base leading-7 text-ink outline-none"
      />
      {note ? <p className="text-sm text-muted">{saving ? labels.saving : note}</p> : null}
    </div>
  );
}
