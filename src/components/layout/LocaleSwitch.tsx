import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function LocaleSwitch({ locale }: { locale: Locale }) {
  return (
    <div dir="ltr" className="flex items-center rounded-full bg-accent-soft p-0.5">
      <span className="sr-only">{t(locale, "language")}</span>
      {(["fr", "he"] as const).map((code) => {
        const active = locale === code;
        return (
          <form key={code} action={setLocale}>
            <input type="hidden" name="locale" value={code} />
            <button
              type="submit"
              className={`min-h-8 min-w-8 rounded-full px-2 text-xs font-semibold transition-colors ${
                active ? "bg-ink text-white" : "text-muted"
              }`}
              aria-pressed={active}
            >
              {code === "fr" ? "FR" : "עב"}
            </button>
          </form>
        );
      })}
    </div>
  );
}
