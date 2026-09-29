import "../scripts/_load-env";
import { PrismaClient } from "@prisma/client";
import { weekStartsOnFor, isInPersonVisitType, isVirtualVisitType } from "../src/lib/visits/had-week";
import {
  jerusalemWeekBounds,
  shiftJerusalemDay,
  formatJerusalemInput,
  jerusalemDateKey,
  parseJerusalemInput,
} from "../src/lib/visits/time";
import {
  getSlots,
  overallStatus,
  countByState,
  workloadLine,
  isDueToday,
  criticalMissingTypes,
  firstPhoneDigits,
  toIntlPhone,
  haversineKm,
} from "../src/lib/tournee/logic";
import { CITY_COORDS } from "../src/lib/tournee/seed";
import type { TourneePatient, VisitEntry, VisitKind } from "../src/lib/tournee/types";

const db = new PrismaClient();

async function load(locale: "fr" | "he" = "fr") {
  const weekStartsOn = weekStartsOnFor(locale);
  const week = jerusalemWeekBounds(new Date(), weekStartsOn);
  const weekEndInclusive = shiftJerusalemDay(week.endKeyExclusive, -1) ?? week.startKey;
  const patients = await db.patient.findMany({
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
  });

  return {
    weekStart: week.startKey,
    weekEnd: weekEndInclusive,
    patients: patients.map((p): TourneePatient => {
      const phones = [p.phone, p.contactPhone].filter((v): v is string => Boolean(v && v.trim()));
      const history: VisitEntry[] = [];
      for (const visit of p.visits) {
        let kind: VisitKind | null = null;
        if (isInPersonVisitType(visit.type)) kind = "home";
        else if (isVirtualVisitType(visit.type)) kind = "phone";
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
        notes: [p.accessInstructions, p.operationalNote].filter(Boolean).join(" · "),
        cycleStart: week.startKey,
        cycleEnd: weekEndInclusive,
        endOfCare: p.plannedDischargeDate ? jerusalemDateKey(p.plannedDischargeDate) : null,
        history,
        latitude: p.latitude,
        longitude: p.longitude,
      };
    }),
  };
}

async function main() {
  const results: Record<string, unknown> = {};
  const snap = await load("fr");

  results["1_chargement"] = {
    ok: snap.patients.length > 0,
    patients: snap.patients.length,
    week: `${snap.weekStart} → ${snap.weekEnd}`,
    counts: countByState(snap.patients),
    workload: workloadLine(snap.patients),
    dueToday: snap.patients.filter(isDueToday).length,
    withPhone: snap.patients.filter((p) => p.phones.length > 0).length,
    withGeo: snap.patients.filter((p) => p.latitude != null).length,
  };

  const acher = snap.patients.find((p) => p.firstName === "Acher" && String(p.city).includes("רמלה"));
  if (!acher) throw new Error("Acher Ramle introuvable");

  results["2_slots_acher"] = {
    quotas: { home: acher.homeQuota, phone: acher.phoneQuota },
    status: overallStatus(acher),
    slots: getSlots(acher).map((s) => ({ type: s.type, status: s.status, hasEntry: s.entryIndex >= 0 })),
    critical: criticalMissingTypes(acher),
    ok: acher.homeQuota === 2 && acher.phoneQuota === 1 && getSlots(acher).length === 3,
  };

  const patientId = acher.id;
  const occurredAt = parseJerusalemInput(`${snap.weekStart}T10:30`);
  if (!occurredAt) throw new Error("date invalide");

  const created = await db.$transaction(async (tx) => {
    const v = await tx.visit.create({
      data: { patientId, type: "IN_PERSON", occurredAt, notes: "test-tournee-check" },
      select: { id: true },
    });
    await tx.clinicalReport.create({
      data: { visitId: v.id, status: "DRAFT", templateKey: "in_person" },
    });
    return v;
  });

  let after = (await load("fr")).patients.find((p) => p.id === patientId)!;
  results["3_creer_visite_draft"] = {
    ok: after.history.some((h) => h.visitId === created.id && !h.done && !h.docWritten),
    history: after.history.length,
    homePendingSlots: getSlots(after).filter((s) => s.type === "home" && s.status !== "done").length,
    homeDoneSlots: getSlots(after).filter((s) => s.type === "home" && s.status === "done").length,
  };

  await db.clinicalReport.update({
    where: { visitId: created.id },
    data: { status: "VALIDATED", validatedAt: new Date() },
  });
  after = (await load("fr")).patients.find((p) => p.id === patientId)!;
  const entry = after.history.find((h) => h.visitId === created.id)!;
  results["4_valider_transmission"] = {
    ok: entry.done && entry.docWritten,
    homeDoneSlots: getSlots(after).filter((s) => s.type === "home" && s.status === "done").length,
    homePendingSlots: getSlots(after).filter((s) => s.type === "home" && s.status !== "done").length,
    status: overallStatus(after).state,
  };

  await db.clinicalReport.update({
    where: { visitId: created.id },
    data: { status: "DRAFT", validatedAt: null, validatedById: null },
  });
  after = (await load("fr")).patients.find((p) => p.id === patientId)!;
  const entry2 = after.history.find((h) => h.visitId === created.id)!;
  results["5_deverrouiller_transmission"] = {
    ok: !entry2.done && !entry2.docWritten,
  };

  const prevHome = acher.homeQuota;
  await db.patient.update({ where: { id: patientId }, data: { weeklyInPersonVisits: prevHome + 1 } });
  after = (await load("fr")).patients.find((p) => p.id === patientId)!;
  results["6_maj_quotas"] = {
    ok: after.homeQuota === prevHome + 1,
    before: prevHome,
    after: after.homeQuota,
    homeSlots: getSlots(after).filter((s) => s.type === "home").length,
  };
  await db.patient.update({ where: { id: patientId }, data: { weeklyInPersonVisits: prevHome } });

  const newP = await db.patient.create({
    data: {
      firstName: "TestTournee",
      lastName: "Check",
      city: "Lod",
      phone: "0500000000",
      weeklyInPersonVisits: 1,
      weeklyVirtualVisits: 0,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  after = (await load("fr")).patients.find((p) => p.id === newP.id)!;
  results["7_creer_patient"] = {
    ok: Boolean(after) && getSlots(after).length === 1,
    name: after?.name,
    slots: after ? getSlots(after).length : 0,
  };

  // nearby distance for Acher from Lod city centroid
  const lod = CITY_COORDS.Lod;
  const acherPoint =
    acher.latitude != null && acher.longitude != null
      ? { lat: acher.latitude, lng: acher.longitude }
      : null;
  results["8_proches_geo"] = {
    ok: Boolean(acherPoint && lod),
    kmFromLod: acherPoint && lod ? Number(haversineKm(lod, acherPoint).toFixed(1)) : null,
    hasCoords: Boolean(acherPoint),
  };

  // phone / whatsapp
  const digits = firstPhoneDigits(acher);
  const intl = toIntlPhone(digits);
  results["9_telephone_whatsapp"] = {
    ok: Boolean(digits && intl?.startsWith("972")),
    digits,
    intl,
  };

  // Alicia multi-phone in one field
  const alicia = snap.patients.find((p) => p.firstName === "Alicia")!;
  const aliciaDigits = firstPhoneDigits(alicia);
  results["10_phone_multi"] = {
    phones: alicia.phones,
    firstDigits: aliciaDigits,
    note: "Champ phone contient parfois 2 numéros séparés par / — seul le premier bloc de chiffres est utilisé",
    ok: Boolean(aliciaDigits),
  };

  // delete visit (draft)
  await db.clinicalReport.deleteMany({ where: { visitId: created.id } });
  await db.visit.delete({ where: { id: created.id } });
  after = (await load("fr")).patients.find((p) => p.id === patientId)!;
  results["11_supprimer_visite"] = {
    ok: !after.history.some((h) => h.visitId === created.id),
  };

  await db.patient.delete({ where: { id: newP.id } });
  const gone = (await load("fr")).patients.find((p) => p.id === newP.id);
  results["12_supprimer_patient_test"] = { ok: !gone };

  // validated visits cannot be deleted by tournee rules — verify exists
  const locked = await db.visit.findFirst({
    where: { report: { is: { status: "VALIDATED" } } },
    select: { id: true, report: { select: { status: true } } },
  });
  results["13_lock_validated"] = {
    ok: locked?.report?.status === "VALIDATED",
    sampleVisitId: locked?.id ?? null,
  };

  const failed = Object.entries(results).filter(([, v]) => {
    if (v && typeof v === "object" && "ok" in v) return !(v as { ok: boolean }).ok;
    return false;
  });
  results.summary = {
    passed: Object.keys(results).length - 1 - failed.length,
    failed: failed.map(([k]) => k),
    allOk: failed.length === 0,
  };

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
