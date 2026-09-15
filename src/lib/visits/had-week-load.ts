import "server-only";

import type { PrismaClient } from "@prisma/client";

import {
  hasWeeklyHadTargets,
  weeklyHadProgress,
  type WeeklyHadProgress,
  type WeeklyHadTargets,
} from "@/lib/visits/had-week";
import { jerusalemWeekBounds } from "@/lib/visits/time";

/**
 * Charge le progrès HAD de la semaine pour une liste de patients.
 * Une seule requête de visites VALIDÉES — Aujourd’hui / Agenda / tournée.
 */
export async function loadWeeklyHadForPatients(
  db: PrismaClient,
  patients: WeeklyHadTargets[],
  now = new Date(),
  weekStartsOn: 0 | 1 = 0,
) {
  const week = jerusalemWeekBounds(now, weekStartsOn);
  const map = new Map<string, WeeklyHadProgress>();
  const tracked = patients.filter(hasWeeklyHadTargets);
  if (tracked.length === 0) return map;

  const visits = await db.visit.findMany({
    where: {
      patientId: { in: tracked.map((patient) => patient.id) },
      occurredAt: { gte: week.start, lt: week.end },
      report: { is: { status: "VALIDATED" } },
    },
    select: {
      patientId: true,
      type: true,
      report: { select: { status: true } },
    },
  });

  const byPatient = new Map<string, typeof visits>();
  for (const visit of visits) {
    const list = byPatient.get(visit.patientId) ?? [];
    list.push(visit);
    byPatient.set(visit.patientId, list);
  }

  for (const patient of tracked) {
    map.set(
      patient.id,
      weeklyHadProgress(patient, byPatient.get(patient.id) ?? [], now, weekStartsOn),
    );
  }
  return map;
}
