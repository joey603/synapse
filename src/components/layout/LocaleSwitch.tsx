"use client";

import { useTransition } from "react";

import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition();

  return (
    <div dir="ltr" className="flex items-center rounded-full bg-accent-soft p-0.5">
      <span className="sr-only">{t(locale, "language")}</span>
      {(["fr", "he"] as const).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            disabled={pending}
            onClick={() => {
              const data = new FormData();
              data.set("locale", code);
              startTransition(() => {
                void setLocale(data);
              });
            }}
            className={`min-h-8 min-w-8 rounded-full px-2 text-xs font-semibold transition-colors disabled:opacity-70 ${
              active ? "bg-ink text-white" : "text-muted"
            }`}
            aria-pressed={active}
          >
            {code === "fr" ? "FR" : "עב"}
          </button>
        );
      })}
    </div>
  );
}
