import type { ReactNode } from "react";

const VARIANTS = {
  /** Prochain RDV, transmission principale, identité patient. */
  primary:
    "overflow-hidden rounded-synapse-lg bg-card ring-1 ring-line/60",
  /** Listes, sections secondaires, blocs patient. */
  secondary:
    "overflow-hidden rounded-synapse-md bg-card ring-1 ring-line/70",
  /** Champs structurés / métadonnées à l’intérieur d’un écran. */
  inner:
    "overflow-hidden rounded-synapse-sm bg-field ring-1 ring-line/55",
} as const;

export type SurfaceCardVariant = keyof typeof VARIANTS;

export function SurfaceCard({
  children,
  className = "",
  id,
  variant = "secondary",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: SurfaceCardVariant;
}) {
  return (
    <div id={id} className={`${VARIANTS[variant]} ${className}`}>
      {children}
    </div>
  );
}
