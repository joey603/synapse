"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type Segment = {
  id: string;
  label: string;
  href: string;
};

export function SegmentedControl({ segments }: { segments: Segment[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? segments[0]?.id;

  return (
    <div className="flex rounded-2xl bg-surface p-1">
      {segments.map((segment) => {
        const active = current === segment.id;
        const href = segment.href.includes("?")
          ? segment.href
          : `${pathname}?tab=${segment.id}`;

        return (
          <Link
            key={segment.id}
            href={href}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors ${
              active ? "bg-card text-ink shadow-[0_2px_8px_rgba(27,36,48,0.06)]" : "text-muted"
            }`}
          >
            {segment.label}
          </Link>
        );
      })}
    </div>
  );
}
