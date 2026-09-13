export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card px-5 py-8 text-center shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
