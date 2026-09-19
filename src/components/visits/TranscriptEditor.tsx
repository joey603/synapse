"use client";

import { useEffect, useState } from "react";

import { BidiRichText } from "@/components/ui/BidiRichText";
import { BIDI_TEXT_CLASS, stripBidiMarks, textDirection, wrapRtlIsolates } from "@/lib/i18n/text-direction";
import { VISIT_FLUSH_SAVE_EVENT } from "@/lib/visits/flush-save";

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

  async function save(value: string) {
    setSaving(true);
    setNote(labels.saving);
    try {
      const response = await fetch(`/api/visits/${visitId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: stripBidiMarks(value) }),
      });
      setNote(response.ok ? labels.saved : labels.lost);
    } catch {
      setNote(labels.lost);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (locked || text === initialText) return;
    const timer = window.setTimeout(() => {
      void save(text);
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on text only
  }, [initialText, locked, text, visitId]);

  useEffect(() => {
    if (locked) return;
    function onFlush() {
      void save(text);
    }
    window.addEventListener(VISIT_FLUSH_SAVE_EVENT, onFlush);
    return () => window.removeEventListener(VISIT_FLUSH_SAVE_EVENT, onFlush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, text, visitId]);

  const showingOriginal = view === "original" && canCompare;
  const displayText = showingOriginal ? originalText ?? "" : text;
  const direction = textDirection(displayText);
  const fieldClass = `min-h-72 w-full synapse-field synapse-document-text px-4 py-4 ${BIDI_TEXT_CLASS}`;
  const readOnly = locked || showingOriginal;

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
        <div className={`rounded-2xl bg-field px-4 py-3 text-sm leading-6 text-ink ${BIDI_TEXT_CLASS}`}>
          <span className="mb-1 block text-xs font-semibold text-accent">{labels.source}</span>
          <BidiRichText text={highlight} className="font-medium text-ink" />
        </div>
      ) : null}
      {readOnly ? (
        <BidiRichText text={displayText} className={fieldClass} />
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
      {note ? <p className="text-sm text-muted">{saving ? labels.saving : note}</p> : null}
    </div>
  );
}
