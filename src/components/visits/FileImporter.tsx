"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";

type Kind = "audio" | "text";

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
  const inputRef = useRef<HTMLInputElement>(null);

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

        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
        >
          {t(locale, "audioChoose")}
        </Button>

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
