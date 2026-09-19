import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";

export function PatientListRow({
  href,
  name,
  meta,
  badge,
  badgeTone = "success",
  photoUrl,
}: {
  href: string;
  name: string;
  meta: string;
  badge?: string;
  badgeTone?: StatusBadgeTone | "success" | "danger" | "muted";
  photoUrl?: string | null;
}) {
  const tone: StatusBadgeTone =
    badgeTone === "success"
      ? "success"
      : badgeTone === "danger"
        ? "danger"
        : badgeTone === "muted"
          ? "muted"
          : badgeTone;

  return (
    <Link
      href={href}
      className="flex min-h-[5rem] items-center gap-3 px-4 py-3 synapse-transition active:bg-surface/70"
    >
      <Avatar name={name} photoUrl={photoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{name}</p>
          {badge ? (
            <StatusBadge tone={tone} className="min-w-0 max-w-[4.75rem] justify-center">
              {badge}
            </StatusBadge>
          ) : null}
        </div>
        {meta ? <p className="truncate text-sm text-muted">{meta}</p> : null}
      </div>
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-faint rtl:rotate-180" fill="none" aria-hidden="true">
        <path
          d="M9.5 7.5 14 12l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
