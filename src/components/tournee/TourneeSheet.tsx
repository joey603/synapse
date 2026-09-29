"use client";

import type { ReactNode } from "react";

export function TourneeSheet({
  open,
  title,
  onClose,
  children,
  wideActions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wideActions?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-synapse-xl bg-card shadow-nav sm:rounded-synapse-xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-surface"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {wideActions ? <div className="shrink-0 border-t border-line/70 px-5 py-3">{wideActions}</div> : null}
      </div>
    </div>
  );
}
