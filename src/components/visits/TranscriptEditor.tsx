"use client";

import { useState } from "react";

export function TranscriptEditor({
  visitId,
  initialText,
  locked,
  edited,
  highlight,
  labels,
}: {
  visitId: string;
  initialText: string;
  locked: boolean;
  edited: boolean;
  highlight?: string;
  labels: {
    raw: string;
    edited: string;
    note: string;
    save: string;
    saved: string;
    lost: string;
    source: string;
  };
}) {
  const [text, setText] = useState(initialText);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setNote("");
    try {
      const response = await fetch(`/api/visits/${visitId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setNote(response.ok ? labels.saved : labels.lost);
    } catch {
      setNote(labels.lost);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted">{edited ? labels.edited : labels.raw}</p>
      <p className="text-xs leading-5 text-muted">{labels.note}</p>
      {highlight ? (
        <p className="rounded-2xl bg-field px-4 py-3 text-sm leading-6 text-ink">
          <span className="block text-xs font-semibold text-accent">{labels.source}</span>
          <mark className="bg-transparent font-medium text-ink">{highlight}</mark>
        </p>
      ) : null}
      <textarea
        value={text}
        readOnly={locked}
        onChange={(event) => setText(event.target.value)}
        className="min-h-72 w-full rounded-3xl bg-field px-4 py-4 text-base leading-7 text-ink outline-none"
      />
      {locked ? null : (
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || text.trim() === initialText.trim()}
          className="min-h-12 rounded-2xl bg-accent text-sm font-semibold text-white disabled:opacity-50"
        >
          {labels.save}
        </button>
      )}
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}
