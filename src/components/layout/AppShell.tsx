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
              label={t(locale, "logout")}
              idle={<LogoutIcon />}
              pending={<LogoutIcon className="opacity-50" />}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-danger disabled:opacity-70"
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
      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-3 [-webkit-overflow-scrolling:touch]">
        {children}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}

function LogoutIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" aria-hidden="true">
      <path
        d="M10 7V6.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C11.52 3 12.08 3 13.2 3h3.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C20 4.52 20 5.08 20 6.2v11.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C18.48 21 17.92 21 16.8 21h-3.6c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C10 19.48 10 18.92 10 17.8V17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15 12H4m0 0 2.5-2.5M4 12l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
