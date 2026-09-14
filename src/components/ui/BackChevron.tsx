import type { Locale } from "@/lib/i18n/locale";

export function BackChevron({ locale, className = "h-4 w-4" }: { locale: Locale; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} ${locale === "he" ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.5 7.5 10 12l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
