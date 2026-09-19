const TONES = {
  muted: "bg-transparent text-muted ring-1 ring-line/75",
  progress: "bg-transparent text-accent ring-1 ring-accent/25",
  warning: "bg-transparent text-warning ring-1 ring-warning/30",
  /** Actif / validé — discret, peu saturé */
  success: "bg-transparent text-success/80 ring-1 ring-line/70",
  danger: "bg-transparent text-danger ring-1 ring-danger/25",
} as const;

export type StatusBadgeTone = keyof typeof TONES;

export function StatusBadge({
  children,
  tone = "muted",
  className = "",
}: {
  children: string;
  tone?: StatusBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Mapping métier → ton pour workflows visite / rapport. */
export function toneForWorkflow(status: string): StatusBadgeTone {
  switch (status) {
    case "VALIDATED":
    case "workflowValidated":
      return "success";
    case "TRANSMISSION_GENERATED":
    case "AI_GENERATED":
    case "REVIEWED":
    case "workflowTransmission":
      return "warning";
    case "ANALYZED":
    case "TRANSCRIBED":
    case "EXTRACTING":
    case "GENERATING":
    case "TRANSCRIBING":
    case "workflowAnalyzed":
    case "workflowTranscribed":
      return "progress";
    case "FAILED":
    case "DISCHARGED":
      return "danger";
    default:
      return "muted";
  }
}

export function toneForPatientStatus(status: "ACTIVE" | "INACTIVE" | "DISCHARGED"): StatusBadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "DISCHARGED") return "danger";
  return "muted";
}
