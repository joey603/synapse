export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-accent text-white ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-[58%] w-[58%]" fill="none">
        <circle cx="11" cy="16" r="3.2" fill="currentColor" />
        <circle cx="21.5" cy="10" r="2.3" fill="currentColor" opacity="0.72" />
        <circle cx="21.5" cy="22" r="2.3" fill="currentColor" opacity="0.72" />
        <path
          d="M14 14.8 19.2 11.4M14 17.2 19.2 20.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
