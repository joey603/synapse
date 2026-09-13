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
  default: "bg-surface text-accent",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
};

export function QuickActionGrid({ items }: { items: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Link
          key={item.href + item.title}
          href={item.href}
          className="flex min-h-[7.5rem] flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_8px_24px_rgba(27,36,48,0.06)] transition-transform active:scale-[0.98]"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[item.tone ?? "default"]}`}
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
