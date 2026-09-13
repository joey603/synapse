import Link from "next/link";
import type { ReactNode } from "react";

export function ActionRow({
  href,
  title,
  subtitle,
  icon,
  trailing,
}: {
  href: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 transition-colors active:bg-surface/70"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
        {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
      </div>
      {trailing ?? <ChevronIcon />}
    </Link>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-faint" fill="none" aria-hidden="true">
      <path
        d="M9.5 7.5 14 12l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
