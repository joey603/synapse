export function Mark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Synapse"
      className={`inline-flex items-baseline text-[1.35rem] font-semibold leading-none tracking-[-0.03em] text-ink ${className}`}
    >
      <span aria-hidden="true">S</span>
      <svg
        viewBox="0 0 16 22"
        className="mx-[0.01em] h-[1.05em] w-[0.72em] translate-y-[0.38em] text-accent"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="3.15" cy="3.15" r="1.7" fill="currentColor" />
        <circle cx="12.85" cy="3.15" r="1.7" fill="currentColor" />
        <path
          d="M4.35 4.35 7.15 8.35"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
        />
        <path
          d="M11.65 4.35 8.85 8.35"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
        />
        <circle cx="8" cy="9.55" r="1.15" fill="currentColor" />
        <path d="M8 10.85v5.15" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
        <circle cx="8" cy="17.55" r="1.55" fill="currentColor" />
      </svg>
      <span aria-hidden="true">napse</span>
    </span>
  );
}
