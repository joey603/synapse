import Link from "next/link";
import type { ReactNode } from "react";

export type QuickAction = {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone?: "default" | "accent" | "danger";
};

const toneClasses = {
  default: "bg-accent-soft text-terra",
  accent: "bg-accent-soft text-terra",
  danger: "bg-danger-soft text-danger",
};

export function QuickActionGrid({ items }: { items: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Link
          key={item.href + item.title}
          href={item.href}
          className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-[0_8px_24px_rgba(27,36,48,0.06)] transition-transform active:scale-[0.98]"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClasses[item.tone ?? "default"]}`}
          >
            {item.icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-snug text-ink">{item.title}</p>
            <p className="truncate text-xs text-muted">{item.subtitle}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
