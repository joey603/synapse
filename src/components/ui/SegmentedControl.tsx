"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type Segment = {
  id: string;
  label: string;
  href: string;
};

export function SegmentedControl({
  segments,
  scroll = true,
  activeId,
}: {
  segments: Segment[];
  scroll?: boolean;
  activeId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = activeId ?? searchParams.get("tab") ?? segments[0]?.id;

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
            scroll={scroll}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-xl px-1.5 text-center text-sm font-semibold leading-4 transition-colors ${
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
