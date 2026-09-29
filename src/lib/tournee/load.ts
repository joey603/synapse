import "server-only";

import type { ReportStatus, VisitType } from "@prisma/client";

import { db, withDbRetry } from "@/lib/db";
import type { Locale } from "@/lib/i18n/locale";
import { isInPersonVisitType, isVirtualVisitType, weekStartsOnFor } from "@/lib/visits/had-week";
import {
  formatJerusalemInput,
  jerusalemDateKey,
  jerusalemWeekBounds,
  shiftJerusalemDay,
} from "@/lib/visits/time";
import type { TourneePatient, TourneeSnapshot, VisitEntry, VisitKind } from "@/lib/tournee/types";

export async function loadTourneeSnapshot(locale: Locale, now = new Date()): Promise<TourneeSnapshot> {
  const weekStartsOn = weekStartsOnFor(locale);
  const week = jerusalemWeekBounds(now, weekStartsOn);
  const weekEndInclusive = shiftJerusalemDay(week.endKeyExclusive, -1) ?? week.startKey;

  const patients = await withDbRetry(() =>
    db.patient.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        address: true,
        phone: true,
        contactPhone: true,
        accessInstructions: true,
        operationalNote: true,
        weeklyInPersonVisits: true,
        weeklyVirtualVisits: true,
        plannedDischargeDate: true,
        latitude: true,
        longitude: true,
        visits: {
          where: { occurredAt: { gte: week.start, lt: week.end } },
          orderBy: { occurredAt: "asc" },
          select: {
            id: true,
            type: true,
            occurredAt: true,
            notes: true,
            report: { select: { status: true } },
          },
        },
      },
    }),
  );

  return {
    locale,
    weekStart: week.startKey,
    weekEnd: weekEndInclusive,
    patients: patients.map((p) => mapPatient(p, week.startKey, weekEndInclusive)),
  };
}

function mapPatient(
  p: {
    id: string;
    firstName: string;
    lastName: string;
    city: string | null;
    address: string | null;
    phone: string | null;
    contactPhone: string | null;
    accessInstructions: string | null;
    operationalNote: string | null;
    weeklyInPersonVisits: number | null;
    weeklyVirtualVisits: number | null;
    plannedDischargeDate: Date | null;
    latitude: number | null;
    longitude: number | null;
    visits: Array<{
      id: string;
      type: VisitType;
      occurredAt: Date;
      notes: string | null;
      report: { status: ReportStatus } | null;
    }>;
  },
  cycleStart: string,
  cycleEnd: string,
): TourneePatient {
  const phones = [p.phone, p.contactPhone]
    .flatMap((v) => (v ? v.split(/[/|,;]+/) : []))
    .map((v) => v.trim())
    .filter(Boolean);
  const notes = [p.accessInstructions, p.operationalNote].filter(Boolean).join(" · ");

  const history: VisitEntry[] = [];
  for (const visit of p.visits) {
    const kind = visitKindFromType(visit.type);
    if (!kind) continue;
    const stamp = formatJerusalemInput(visit.occurredAt);
    const status = visit.report?.status ?? null;
    history.push({
      visitId: visit.id,
      type: kind,
      date: stamp.slice(0, 10),
      time: stamp.slice(11, 16),
      done: status === "VALIDATED",
      note: visit.notes ?? "",
      docWritten: status === "VALIDATED" || status === "REVIEWED",
      reportStatus: status,
    });
  }

  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    firstName: p.firstName,
    lastName: p.lastName,
    city: p.city?.trim() || "—",
    address: p.address?.trim() || "",
    phones,
    homeQuota: p.weeklyInPersonVisits ?? 0,
    phoneQuota: p.weeklyVirtualVisits ?? 0,
    notes,
    cycleStart,
    cycleEnd,
    endOfCare: p.plannedDischargeDate ? jerusalemDateKey(p.plannedDischargeDate) : null,
    history,
    latitude: p.latitude,
    longitude: p.longitude,
  };
}

function visitKindFromType(type: VisitType): VisitKind | null {
  if (isInPersonVisitType(type)) return "home";
  if (isVirtualVisitType(type)) return "phone";
  return null;
}
