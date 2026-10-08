"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { PendingButton, PendingForm } from "@/components/auth/PendingButton";
import { Mark } from "@/components/brand/Mark";
import { LocaleSwitch } from "@/components/layout/LocaleSwitch";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function ShellChrome({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const home = pathname === "/";
  const [tripFocus, setTripFocus] = useState(false);

  useEffect(() => {
    const sync = () => setTripFocus(document.documentElement.dataset.tripFocus === "1");
    sync();
    window.addEventListener("synapse-trip-focus", sync);
    return () => window.removeEventListener("synapse-trip-focus", sync);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {tripFocus ? null : (
        <div className="shrink-0 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div
            dir="ltr"
            className="grid grid-cols-[1fr_auto_1fr] items-center rounded-synapse-chrome border border-line/80 bg-card px-4 py-2 shadow-nav"
          >
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
      )}
      <main
        className={
          tripFocus
            ? "min-h-0 flex-1 overflow-hidden overscroll-none p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : home
              ? "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 [-webkit-overflow-scrolling:touch]"
              : "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 [-webkit-overflow-scrolling:touch]"
        }
      >
        {children}
      </main>
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
