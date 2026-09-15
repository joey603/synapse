"use client";

import { useEffect, useId, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function PatientPhotoField({
  locale,
  name,
  photoUrl,
}: {
  locale: Locale;
  name: string;
  photoUrl?: string | null;
}) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = remove ? null : preview ?? photoUrl ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink">{t(locale, "fieldPhoto")}</p>
      <div className="flex items-center gap-4">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <Avatar name={name || "?"} size="lg" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-accent-soft px-3 text-sm font-semibold text-accent"
          >
            {t(locale, "photoChoose")}
          </label>
          <input
            id={inputId}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (preview) URL.revokeObjectURL(preview);
              if (!file) {
                setPreview(null);
                return;
              }
              setRemove(false);
              setPreview(URL.createObjectURL(file));
            }}
          />
          <p className="text-xs text-muted">{t(locale, "photoHint")}</p>
          {photoUrl && !preview ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="removePhoto"
                checked={remove}
                onChange={(event) => setRemove(event.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              {t(locale, "photoRemove")}
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
