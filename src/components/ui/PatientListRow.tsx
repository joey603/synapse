import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";

export function PatientListRow({
  href,
  name,
  meta,
  badge,
  badgeTone = "success",
}: {
  href: string;
  name: string;
  meta: string;
  badge?: string;
  badgeTone?: "success" | "danger" | "muted";
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[5rem] items-center gap-3 px-4 py-3 transition-colors active:bg-surface/70"
    >
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{name}</p>
        <p className="truncate text-sm text-muted">{meta}</p>
        {badge ? (
          <span
            className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              badgeTone === "danger"
                ? "bg-danger-soft text-danger"
                : badgeTone === "muted"
                  ? "bg-surface text-muted"
                  : "bg-success-soft text-success"
            }`}
          >
            {badge}
          </span>
        ) : null}
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
