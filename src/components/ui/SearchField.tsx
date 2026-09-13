import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function SearchField({
  locale,
  name = "q",
  defaultValue = "",
  action = "/patients",
}: {
  locale: Locale;
  name?: string;
  defaultValue?: string;
  action?: string;
}) {
  return (
    <form action={action} method="get" className="relative">
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
        defaultValue={defaultValue}
        placeholder={t(locale, "searchPlaceholder")}
        className="min-h-12 w-full rounded-2xl border-0 bg-card py-3 ps-11 pe-4 text-base text-ink shadow-[0_8px_24px_rgba(27,36,48,0.06)] outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25"
      />
    </form>
  );
}
