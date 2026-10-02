import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  extractPhoneCandidates,
  normalizePhoneDigits,
  type RosterPatient,
} from "@/lib/patients/tournee-roster";
import { splitStreetAndAccess } from "@/lib/patients/parse-tournee-list";

export type SyncRosterResult = {
  created: string[];
  updated: string[];
  discharged: string[];
  totalRoster: number;
};

type DbPatient = {
  id: string;
  firstName: string;
  lastName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  contactName: string | null;
  contactPhone: string | null;
  accessInstructions: string | null;
  weeklyInPersonVisits: number | null;
  weeklyVirtualVisits: number | null;
  operationalNote: string | null;
  status: "ACTIVE" | "INACTIVE" | "DISCHARGED";
};

function normName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sameCity(a: string | null | undefined, b: string) {
  return (a ?? "").trim() === b.trim();
}

function patientPhones(p: DbPatient) {
  return [...extractPhoneCandidates(p.phone), ...extractPhoneCandidates(p.contactPhone)];
}

function displayName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim();
}

function matchRosterToPatient(roster: RosterPatient, patients: DbPatient[], used: Set<string>) {
  const rosterPhones = new Set(roster.phones.map(normalizePhoneDigits).filter(Boolean));
  if (roster.contactPhone) rosterPhones.add(normalizePhoneDigits(roster.contactPhone));

  for (const p of patients) {
    if (used.has(p.id)) continue;
    if (patientPhones(p).some((ph) => rosterPhones.has(ph))) return p;
  }

  const first = normName(roster.firstName);
  const last = normName(roster.lastName);
  for (const p of patients) {
    if (used.has(p.id)) continue;
    if (!sameCity(p.city, roster.city)) continue;
    if (normName(p.firstName) !== first) continue;
    const dbLast = normName(p.lastName);
    if (last) {
      if (dbLast === last) return p;
      continue;
    }
    if (!dbLast || dbLast === first) return p;
  }

  return null;
}

function rosterPayload(roster: RosterPatient) {
  const primary = roster.phones[0] ?? null;
  const secondary =
    roster.contactPhone ??
    (roster.phones.length > 1 ? roster.phones.slice(1).join(" / ") : null);

  const rescued = rescueStreetAddress(roster.address, roster.city, roster.accessInstructions);

  return {
    firstName: roster.firstName,
    lastName: roster.lastName,
    city: roster.city,
    address: rescued.address,
    phone: primary,
    contactName: roster.contactName,
    contactPhone: secondary,
    accessInstructions: rescued.access,
    weeklyInPersonVisits: roster.homeQuota,
    weeklyVirtualVisits: roster.phoneQuota,
    operationalNote: roster.note,
    status: "ACTIVE" as const,
  };
}

/** Si address = ville mais l’accès commence par « רחוב … », on récupère la rue. */
function rescueStreetAddress(address: string, city: string, access: string | null) {
  const street = address.trim();
  const town = city.trim();
  const accessText = (access ?? "").trim();
  const cityOnly = !street || street === town;
  if (!cityOnly || !accessText) {
    return { address: street, access: accessText || null };
  }
  const { street: rescued, access: rest } = splitStreetAndAccess(accessText);
  if (!rescued || rescued === town) {
    return { address: street, access: accessText || null };
  }
  return { address: rescued, access: rest || null };
}

function needsGeoReset(existing: DbPatient, next: ReturnType<typeof rosterPayload>) {
  return existing.address !== next.address || existing.city !== next.city;
}

export async function syncTourneeRoster(
  actorId: string,
  roster: RosterPatient[],
): Promise<SyncRosterResult> {
  if (!roster.length) {
    return { created: [], updated: [], discharged: [], totalRoster: 0 };
  }

  const patients = await db.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      city: true,
      address: true,
      phone: true,
      contactName: true,
      contactPhone: true,
      accessInstructions: true,
      weeklyInPersonVisits: true,
      weeklyVirtualVisits: true,
      operationalNote: true,
      status: true,
    },
  });

  const used = new Set<string>();
  const created: string[] = [];
  const updated: string[] = [];

  for (const entry of roster) {
    const existing = matchRosterToPatient(entry, patients, used);
    const data = rosterPayload(entry);

    if (existing) {
      used.add(existing.id);
      await db.patient.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(needsGeoReset(existing, data)
            ? { latitude: null, longitude: null, geoKey: null }
            : {}),
        },
      });
      await audit({
        actorId,
        action: "PATIENT_UPDATED",
        entityType: "Patient",
        entityId: existing.id,
        patientId: existing.id,
        metadata: { source: "tournee_roster_sync" },
      });
      updated.push(displayName(data));
      continue;
    }

    const patient = await db.patient.create({
      data,
      select: { id: true, firstName: true, lastName: true },
    });
    used.add(patient.id);
    await audit({
      actorId,
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: patient.id,
      patientId: patient.id,
      metadata: { source: "tournee_roster_sync" },
    });
    created.push(displayName(patient));
  }

  const discharged: string[] = [];
  for (const p of patients) {
    if (p.status !== "ACTIVE") continue;
    if (used.has(p.id)) continue;
    await db.patient.update({
      where: { id: p.id },
      data: { status: "DISCHARGED" },
    });
    await audit({
      actorId,
      action: "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: p.id,
      patientId: p.id,
      metadata: { source: "tournee_roster_sync", status: "DISCHARGED" },
    });
    discharged.push(displayName(p));
  }

  return {
    created,
    updated,
    discharged,
    totalRoster: roster.length,
  };
}
