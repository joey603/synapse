import Link from "next/link";
import type { ReactNode } from "react";

export type QuickAction = {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone?: "default" | "accent" | "danger" | "warning";
};

const toneClasses = {
  default: "bg-accent-soft text-accent-strong",
  accent: "bg-accent-soft text-accent-strong",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function QuickActionGrid({ items }: { items: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Link
          key={item.href + item.title}
          href={item.href}
          className="flex min-h-[7.25rem] flex-col gap-3 rounded-synapse-md bg-card p-4 ring-1 ring-line/70 synapse-transition active:scale-[0.99]"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-synapse-sm ${toneClasses[item.tone ?? "default"]}`}
          >
            {item.icon}
          </div>
          <div>
            <p className="text-[15px] font-semibold leading-snug text-ink">{item.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">{item.subtitle}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
