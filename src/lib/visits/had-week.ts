import type { ReportStatus, VisitType } from "@prisma/client";

import type { Locale } from "@/lib/i18n/locale";
import { jerusalemWeekBounds } from "@/lib/visits/time";

export type WeeklyChannelProgress = {
  target: number | null;
  done: number;
  remaining: number | null;
};

export type WeeklyHadProgress = {
  week: ReturnType<typeof jerusalemWeekBounds>;
  inPerson: WeeklyChannelProgress;
  virtual: WeeklyChannelProgress;
};

export type WeeklyHadTargets = {
  id: string;
  weeklyInPersonVisits: number | null;
  weeklyVirtualVisits: number | null;
};

/** Aligné sur l’agenda : dimanche en hébreu, lundi en français. */
export function weekStartsOnFor(locale: Locale): 0 | 1 {
  return locale === "he" ? 0 : 1;
}

export function hasWeeklyHadTargets(patient: {
  weeklyInPersonVisits: number | null;
  weeklyVirtualVisits: number | null;
}) {
  return patient.weeklyInPersonVisits != null || patient.weeklyVirtualVisits != null;
}

export function isInPersonVisitType(type: VisitType) {
  return type === "IN_PERSON";
}

/** Visites virtuelles / téléphoniques pour le suivi HAD. */
export function isVirtualVisitType(type: VisitType) {
  return type === "VIRTUAL" || type === "PHONE";
}

/** Seules les visites au statut final VALIDATED comptent comme réalisées. */
export function isValidatedVisitReport(status: ReportStatus | null | undefined) {
  return status === "VALIDATED";
}

export function countValidatedWeeklyVisits(
  visits: Array<{ type: VisitType; report: { status: ReportStatus } | null }>,
) {
  let inPerson = 0;
  let virtual = 0;
  for (const visit of visits) {
    if (!isValidatedVisitReport(visit.report?.status)) continue;
    if (isInPersonVisitType(visit.type)) inPerson += 1;
    else if (isVirtualVisitType(visit.type)) virtual += 1;
  }
  return { inPerson, virtual };
}

function channelProgress(target: number | null | undefined, done: number): WeeklyChannelProgress {
  if (target == null) return { target: null, done, remaining: null };
  return { target, done, remaining: Math.max(0, target - done) };
}

/**
 * Calcule le suivi hebdomadaire HAD à partir des cibles patient et des visites
 * déjà filtrées sur la semaine (occurredAt ∈ [start, end[).
 * Ne compte que les rapports VALIDATED.
 */
export function weeklyHadProgress(
  patient: {
    weeklyInPersonVisits: number | null;
    weeklyVirtualVisits: number | null;
  },
  visits: Array<{ type: VisitType; report: { status: ReportStatus } | null }>,
  now = new Date(),
  weekStartsOn: 0 | 1 = 0,
): WeeklyHadProgress {
  const week = jerusalemWeekBounds(now, weekStartsOn);
  const done = countValidatedWeeklyVisits(visits);
  return {
    week,
    inPerson: channelProgress(patient.weeklyInPersonVisits, done.inPerson),
    virtual: channelProgress(patient.weeklyVirtualVisits, done.virtual),
  };
}

/** Filtre Prisma réutilisable : visites VALIDÉES dans la semaine courante. */
export function validatedVisitsInWeekWhere(
  patientId: string,
  now = new Date(),
  weekStartsOn: 0 | 1 = 0,
) {
  const week = jerusalemWeekBounds(now, weekStartsOn);
  return {
    patientId,
    occurredAt: { gte: week.start, lt: week.end },
    report: { is: { status: "VALIDATED" as const } },
  };
}

export function hasHadProgress(progress: WeeklyHadProgress | null | undefined) {
  if (!progress) return false;
  return progress.inPerson.target != null || progress.virtual.target != null;
}
