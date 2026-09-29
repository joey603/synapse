export type VisitKind = "home" | "phone";

export type ReportStatusLite = "DRAFT" | "AI_GENERATED" | "REVIEWED" | "VALIDATED" | null;

export type VisitEntry = {
  /** Id Visit Synapse — null pour un créneau encore vide. */
  visitId: string | null;
  type: VisitKind;
  date: string;
  time: string | null;
  /** true si la visite compte pour le quota HAD (rapport VALIDATED). */
  done: boolean;
  note: string;
  /** Transmission considérée rédigée (VALIDATED ou REVIEWED). */
  docWritten: boolean;
  reportStatus: ReportStatusLite;
};

export type TourneePatient = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  city: string;
  address: string;
  phones: string[];
  homeQuota: number;
  phoneQuota: number;
  notes: string;
  /** Début inclusif de la semaine courante (YYYY-MM-DD Jérusalem). */
  cycleStart: string;
  /** Fin inclusive de la semaine courante (YYYY-MM-DD Jérusalem). */
  cycleEnd: string;
  endOfCare: string | null;
  history: VisitEntry[];
  latitude: number | null;
  longitude: number | null;
};

export type SlotStatus = "done" | "pending" | "urgent";

export type VisitSlot = {
  type: VisitKind;
  status: SlotStatus;
  entryIndex: number;
  date: string | null;
  time: string | null;
};

export type OverallState = "validate" | "overdue" | "soon" | "ok" | "idle";

export type OverallStatus = {
  state: OverallState;
  days: number | null;
};

export type TourneeSnapshot = {
  patients: TourneePatient[];
  weekStart: string;
  weekEnd: string;
  locale: "fr" | "he";
};
