"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

const WAIT_MS = 300;

export function SearchField({
  locale,
  name = "q",
  defaultValue = "",
  action = "/patients",
  params,
}: {
  locale: Locale;
  name?: string;
  defaultValue?: string;
  action?: string;
  params?: Record<string, string>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const extra = JSON.stringify(params ?? {});
  const [seenDefaultValue, setSeenDefaultValue] = useState(defaultValue);

  if (seenDefaultValue !== defaultValue) {
    setSeenDefaultValue(defaultValue);
    setValue(defaultValue);
  }

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === defaultValue) return;
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams();
      for (const [key, item] of Object.entries(JSON.parse(extra) as Record<string, string>)) {
        if (item) next.set(key, item);
      }
      if (trimmed) next.set(name, trimmed);
      const query = next.toString();
      router.replace(query ? `${action}?${query}` : action, { scroll: false });
    }, WAIT_MS);
    return () => window.clearTimeout(handle);
  }, [value, defaultValue, action, name, extra, router]);

  return (
    <form
      action={action}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        for (const [key, item] of Object.entries(params ?? {})) {
          if (item) next.set(key, item);
        }
        const trimmed = value.trim();
        if (trimmed) next.set(name, trimmed);
        const query = next.toString();
        router.replace(query ? `${action}?${query}` : action, { scroll: false });
      }}
      className="relative"
    >
      {Object.entries(params ?? {}).map(([key, item]) =>
        item ? <input key={key} type="hidden" name={key} value={item} /> : null,
      )}
      <label className="sr-only" htmlFor="search">
        {t(locale, "searchPlaceholder")}
      </label>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <input
        id="search"
        name={name}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t(locale, "searchPlaceholder")}
        className="min-h-12 w-full rounded-2xl border-0 bg-field py-3 ps-11 pe-4 text-base text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)] outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25"
      />
    </form>
  );
}
