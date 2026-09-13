"use client";

import { useState } from "react";

import { SurfaceCard } from "@/components/ui/SurfaceCard";

export function AudioUploader({
  action,
  title,
  hint,
  chooseLabel,
  submitLabel,
  emptyLabel,
}: {
  action: string;
  title: string;
  hint: string;
  chooseLabel: string;
  submitLabel: string;
  emptyLabel: string;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <SurfaceCard className="flex flex-col gap-4 p-4" id="audio">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{hint}</p>
      </div>
      <form action={action} method="post" encType="multipart/form-data" className="flex flex-col gap-4">
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-surface px-4 text-sm font-semibold text-accent">
          {file ? file.name : chooseLabel}
          <input
            type="file"
            name="file"
            accept=".m4a,.mp3,.wav,.aac,.webm,audio/mp4,audio/mpeg,audio/wav,audio/aac,audio/webm"
            required
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-sm text-muted">{file ? formatBytes(file.size) : emptyLabel}</p>
        <input type="hidden" name="consent" value="on" />
        <button
          type="submit"
          disabled={!file}
          className="min-h-12 rounded-2xl bg-accent text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </form>
    </SurfaceCard>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
