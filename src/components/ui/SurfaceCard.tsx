import type { ReactNode } from "react";

export function SurfaceCard({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`overflow-hidden rounded-3xl bg-card shadow-[0_8px_24px_rgba(27,36,48,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
