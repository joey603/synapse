"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";

type Kind = "audio" | "text";

const MAX_TEXT_BYTES = 200_000;

export function FileImporter({
  visitId,
  patientId,
  locale,
  allowText,
  textOnly = false,
  embedded = false,
  disabled = false,
}: {
  visitId: string;
  patientId: string;
  locale: Locale;
  allowText: boolean;
  textOnly?: boolean;
  embedded?: boolean;
  disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind | null>(textOnly ? "text" : null);
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const canPaste = allowText || textOnly;

  const accept = textOnly
    ? ".txt,.md,.text,.markdown,text/plain,text/markdown"
    : allowText
      ? ".m4a,.mp3,.wav,.aac,.webm,.txt,.md,.text,.markdown,audio/*,text/plain,text/markdown"
      : ".m4a,.mp3,.wav,.aac,.webm,audio/mp4,audio/mpeg,audio/wav,audio/aac,audio/webm";

  function onPick(next: File | null) {
    setLocalError(null);
    if (!next) {
      setFile(null);
      setKind(textOnly ? "text" : null);
      return;
    }
    const detected = detectKind(next);
    if (!detected) {
      setFile(null);
      setKind(null);
      setLocalError("fileImportErrorType");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (detected === "text" && !allowText && !textOnly) {
      setFile(null);
      setKind(null);
      setLocalError("textImportErrorExists");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (detected === "audio" && textOnly) {
      setFile(null);
      setKind("text");
      setLocalError("textImportErrorType");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(next);
    setKind(detected);
  }

  function applyPastedText(raw: string) {
    const text = raw.replace(/^\uFEFF/, "").trim();
    if (!text) {
      setLocalError("textImportErrorEmpty");
      return false;
    }
    const next = new File([text], "presse-papiers.txt", { type: "text/plain" });
    if (next.size > MAX_TEXT_BYTES) {
      setLocalError("textImportErrorSize");
      return false;
    }
    if (inputRef.current) inputRef.current.value = "";
    setPasteOpen(false);
    setPasteText("");
    onPick(next);
    return true;
  }

  async function onPasteClick() {
    if (!canPaste || disabled || pending) return;
    setLocalError(null);

    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (applyPastedText(text)) return;
        // Vide : on laisse l’erreur empty et on ouvre la zone manuelle.
      } catch {
        // iOS / permission : bascule sur la zone de collage manuelle.
      }
    }

    setPasteOpen(true);
    window.setTimeout(() => pasteRef.current?.focus(), 0);
  }

  function onUsePaste() {
    setLocalError(null);
    applyPastedText(pasteText);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const picked = inputRef.current?.files?.[0] ?? file;
    if (!picked) {
      setLocalError(textOnly ? "textImportErrorType" : "fileImportErrorType");
      return;
    }
    const detected = detectKind(picked);
    if (!detected || (detected === "text" && !allowText && !textOnly) || (detected === "audio" && textOnly)) {
      setLocalError(textOnly ? "textImportErrorType" : "fileImportErrorType");
      return;
    }

    setPending(true);
    setLocalError(null);
    setKind(detected);

    const body = new FormData();
    body.append("file", picked, picked.name || (detected === "text" ? "import.txt" : "import.m4a"));
    if (detected === "audio") body.append("consent", "on");

    const endpoint =
      detected === "text"
        ? `/api/visits/${visitId}/transcript/import`
        : `/api/visits/${visitId}/audio`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body,
        credentials: "same-origin",
        redirect: "follow",
      });
      if (response.url) {
        window.location.assign(response.url);
        return;
      }
      window.location.assign(
        `/patients/${patientId}/visits/${visitId}?tab=transcript&${detected === "text" ? "txt" : "audio"}=save`,
      );
    } catch {
      setPending(false);
      setLocalError(detected === "text" ? "textImportErrorSave" : "audioErrorSave");
    }
  }

  const body = (
    <>
      <div>
        <h2 className="text-sm font-semibold text-ink">{t(locale, "fileImportTitle")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {textOnly
            ? t(locale, "textImportHint")
            : allowText
              ? t(locale, "fileImportHint")
              : t(locale, "audioHint")}
        </p>
      </div>

      {localError ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
          {t(locale, localError)}
        </p>
      ) : null}

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled || pending}
          className="sr-only"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        />

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={disabled || pending}
            onClick={() => inputRef.current?.click()}
          >
            {t(locale, "audioChoose")}
          </Button>
          {canPaste ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={disabled || pending}
              onClick={() => void onPasteClick()}
            >
              {t(locale, "textImportPaste")}
            </Button>
          ) : null}
        </div>

        {pasteOpen ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-6 text-muted">{t(locale, "textImportPasteHint")}</p>
            <textarea
              ref={pasteRef}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              disabled={disabled || pending}
              rows={8}
              className="min-h-40 w-full resize-y rounded-2xl border border-line bg-surface px-3 py-3 text-sm leading-6 text-ink"
              dir="auto"
            />
            <Button type="button" size="md" disabled={disabled || pending || !pasteText.trim()} onClick={onUsePaste}>
              {t(locale, "textImportPasteUse")}
            </Button>
          </div>
        ) : null}

        <p className="truncate text-sm text-muted" title={file?.name} dir="ltr">
          {file
            ? `${file.name}${file.size ? ` · ${formatBytes(file.size)}` : ""}`
            : t(locale, "audioEmpty")}
        </p>

        <Button type="submit" size="md" disabled={disabled || pending || !file || !kind}>
          {t(locale, "audioSubmit")}
        </Button>
      </form>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-3">{body}</div>;
  }

  return (
    <SurfaceCard className="flex flex-col gap-4 p-4" id="import">
      {body}
    </SurfaceCard>
  );
}

function detectKind(file: File): Kind | null {
  const name = (file.name || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".text") ||
    name.endsWith(".markdown") ||
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime.startsWith("text/")
  ) {
    return "text";
  }

  if (
    name.endsWith(".m4a") ||
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".aac") ||
    name.endsWith(".webm") ||
    mime.startsWith("audio/")
  ) {
    return "audio";
  }

  return null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
