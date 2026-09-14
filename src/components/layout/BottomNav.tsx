"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: t(locale, "home"), icon: HomeIcon },
    { href: "/patients", label: t(locale, "patients"), icon: PeopleIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div
        dir="ltr"
        className="mx-auto flex max-w-lg rounded-3xl border border-line/80 bg-card shadow-[0_8px_24px_rgba(27,36,48,0.08)]"
      >
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2H10.2V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.8 17.2c.5-2.2 2.2-3.4 4.2-3.4s3.7 1.2 4.2 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16.2" cy="8.4" r="1.9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M16 13.8c1.6.2 2.8 1.2 3.3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
