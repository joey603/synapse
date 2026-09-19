import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-synapse-md bg-card px-5 py-7 text-center ring-1 ring-line/70">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
