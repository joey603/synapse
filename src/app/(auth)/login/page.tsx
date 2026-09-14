import { cookies } from "next/headers";

import { PendingButton, PendingForm } from "@/components/auth/PendingButton";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header dir="ltr" className="flex items-center justify-between rounded-3xl border border-line/80 bg-card px-4 py-2 shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <Mark />
          <LocaleSwitch locale={locale} />
        </header>
      </div>

      <main className="flex flex-1 flex-col justify-center px-5 py-10">
        <div className="mx-auto w-full max-w-sm rounded-3xl bg-card p-5 shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <h1 className="text-2xl font-semibold leading-tight text-ink">
            {t(locale, "loginTitle")}
          </h1>

          <PendingForm action="/api/auth/login" className="mt-5 flex flex-col gap-3">
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
                className="min-h-12 rounded-2xl border border-line/80 bg-field px-4 text-base font-normal text-ink outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-ink">
              {t(locale, "password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-12 rounded-2xl border border-line/80 bg-field px-4 text-base font-normal text-ink outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <PendingButton
              idle={t(locale, "loginSubmit")}
              pending={t(locale, "loginPending")}
              className="mt-1 min-h-12 rounded-2xl bg-accent text-base font-semibold text-white disabled:opacity-70"
            />
          </PendingForm>
        </div>
      </main>

    </div>
  );
}
