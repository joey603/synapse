import Link from "next/link";
import type { ReactNode } from "react";

import { PendingButton, PendingForm } from "@/components/auth/PendingButton";
import { Mark } from "@/components/brand/Mark";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteProgress } from "@/components/ui/RouteProgress";
import { LocaleSwitch } from "@/components/layout/LocaleSwitch";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function AppShell({
  locale,
  children,
}: {
  locale: Locale;
  userName: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-surface">
      <RouteProgress label={t(locale, "loading")} />
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div dir="ltr" className="grid grid-cols-[1fr_auto_1fr] items-center rounded-3xl border border-line/80 bg-card px-4 py-2 shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <PendingForm action="/api/auth/logout" className="justify-self-start">
            <PendingButton
              idle={t(locale, "logout")}
              pending={t(locale, "logoutPending")}
              className="min-h-11 rounded-full px-1 text-sm font-medium text-danger disabled:opacity-70"
            />
          </PendingForm>
          <Link href="/" className="justify-self-center">
            <Mark />
          </Link>
          <div className="justify-self-end">
            <LocaleSwitch locale={locale} />
          </div>
        </div>
      </div>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3">{children}</main>
      <BottomNav locale={locale} />
    </div>
  );
}
