import type { ReactNode } from "react";

import { SessionKeepAlive } from "@/components/auth/SessionKeepAlive";
import { BottomNav } from "@/components/layout/BottomNav";
import { ShellChrome } from "@/components/layout/ShellChrome";
import { RouteProgress } from "@/components/ui/RouteProgress";
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
      <SessionKeepAlive />
      <RouteProgress label={t(locale, "loading")} />
      <ShellChrome locale={locale}>{children}</ShellChrome>
      <BottomNav locale={locale} />
    </div>
  );
}
