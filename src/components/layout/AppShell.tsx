import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/BottomNav";
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
      <div className="flex justify-end px-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="min-h-11 rounded-full px-3 text-sm font-medium text-muted"
            >
              {t(locale, "logout")}
            </button>
          </form>
          <LocaleSwitch locale={locale} />
        </div>
      </div>
      <main className="flex-1 px-5 pb-36 pt-2">{children}</main>
      <BottomNav locale={locale} />
    </div>
  );
}
