import type { ReactNode } from "react";

import { PendingButton, PendingForm } from "@/components/auth/PendingButton";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-surface">
      <RouteProgress label={t(locale, "loading")} />
      <div dir="ltr" className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <PendingForm action="/api/auth/logout">
          <PendingButton
            idle={t(locale, "logout")}
            pending={t(locale, "logoutPending")}
            className="min-h-11 rounded-full px-3 text-sm font-medium text-danger disabled:opacity-70"
          />
        </PendingForm>
        <LocaleSwitch locale={locale} />
      </div>
      <main className="flex-1 px-5 pb-36 pt-2">{children}</main>
      <BottomNav locale={locale} />
    </div>
  );
}
