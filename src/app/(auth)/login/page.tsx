import { cookies } from "next/headers";

import { Mark } from "@/components/brand/Mark";
import { LocaleSwitch } from "@/components/layout/LocaleSwitch";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const params = await searchParams;
  const error =
    params.error === "locked" ? "locked" : params.error === "invalid" ? "invalid" : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <p className="text-[15px] font-semibold">{t(locale, "appName")}</p>
            <p className="text-xs text-muted">{t(locale, "tagline")}</p>
          </div>
        </div>
        <LocaleSwitch locale={locale} />
      </header>

      <main className="flex flex-1 flex-col justify-center py-10">
        <div className="rounded-3xl bg-card p-6 shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <h1 className="text-[1.75rem] font-semibold leading-tight text-ink">
            {t(locale, "loginTitle")}
          </h1>
          <p className="mt-2 text-[15px] leading-7 text-muted">{t(locale, "loginBody")}</p>

          <form className="mt-6 flex flex-col gap-4" action="/api/auth/login" method="post">
            {error ? (
              <p
                className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
                role="alert"
              >
                {t(locale, error === "locked" ? "loginLocked" : "loginInvalid")}
              </p>
            ) : null}

            <label className="flex flex-col gap-2 text-sm font-medium text-ink">
              {t(locale, "email")}
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className="min-h-12 rounded-2xl border border-line/80 bg-surface px-4 text-base font-normal text-ink outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-ink">
              {t(locale, "password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-12 rounded-2xl border border-line/80 bg-surface px-4 text-base font-normal text-ink outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <button
              type="submit"
              className="mt-1 min-h-12 rounded-2xl bg-accent text-base font-semibold text-white"
            >
              {t(locale, "loginSubmit")}
            </button>
          </form>
        </div>
      </main>

      <p className="text-center text-xs leading-5 text-faint">{t(locale, "loginTrust")}</p>
    </div>
  );
}
