import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-white hover:bg-accent-strong active:bg-accent-strong disabled:bg-accent/50",
  secondary:
    "border border-line/80 bg-card text-accent hover:bg-accent-soft/60 active:bg-accent-soft disabled:opacity-50",
  ghost:
    "bg-transparent text-accent hover:bg-accent-soft/50 active:bg-accent-soft disabled:opacity-50",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:bg-danger/90 disabled:opacity-50",
} as const;

const SIZES = {
  md: "min-h-11 px-4 text-sm font-semibold",
  lg: "min-h-12 px-4 text-sm font-semibold",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "lg",
  type = "button",
  ...props
}: {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex w-full items-center justify-center rounded-synapse-md synapse-transition ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
