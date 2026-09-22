"use client";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-ink">Chargement impossible</h1>
      <p className="max-w-sm text-sm leading-6 text-muted">
        Une erreur temporaire est survenue. Réessaie dans un instant.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-12 rounded-2xl bg-accent px-6 text-sm font-semibold text-white"
      >
        Réessayer
      </button>
    </div>
  );
}
