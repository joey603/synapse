import { PrismaClient } from "@prisma/client";

import {
  LEGACY_BATCH4_AMBIGUOUS,
  LEGACY_VISITS_BATCH4,
  composeLegacyHebrewReport,
  diagnosisFromPatient,
  type LegacyBatch4Visit,
} from "../prisma/data/legacy-visits-batch4";
import { TSABAR_NURSE } from "../prisma/data/tsabar-refoua";
import { templateKeyFor } from "../src/lib/clinical/templates";
import { parseJerusalemInput } from "../src/lib/visits/time";

const NOTE_PREFIX = "legacyImport:";

type Report = {
  patientsBefore: number;
  patientsAfter: number;
  createdVisits: string[];
  updatedVisits: string[];
  skippedVisits: string[];
  ambiguousPatientMatches: string[];
  possibleDuplicates: string[];
  structuredFieldsUpdated: number;
  openAiCalls: 0;
  timeConvention: string[];
  unresolvedPatients: string[];
  unresolvedVisits: string[];
  medicationsChanged: boolean;
  diagnosisPatientChanged: boolean;
  author: string;
  dbVerifiedNew: string[];
};

function noteFor(key: string) {
  return `${NOTE_PREFIX}${key}`;
}

function occurredAtFor(when: string, timeKnown: boolean) {
  const value = timeKnown ? when : `${when}T12:00`;
  return parseJerusalemInput(value);
}

function dayBoundsJerusalem(when: string) {
  const day = when.slice(0, 10);
  const start = parseJerusalemInput(`${day}T00:00`);
  const end = parseJerusalemInput(`${day}T23:59`);
  return { start, end };
}

function structuredComplete(report: {
  patientStatusNote: string | null;
  mainProblems: string | null;
  currentMedication: string | null;
  interventionsProvided: string | null;
  carePlan: string | null;
  drivingRisk: string;
  finalText: string | null;
}) {
  return Boolean(
    report.patientStatusNote?.trim() &&
      report.mainProblems?.trim() &&
      report.currentMedication?.trim() &&
      report.interventionsProvided?.trim() &&
      report.carePlan?.trim() &&
      report.drivingRisk === "NOT_ASSESSED" &&
      report.finalText?.trim(),
  );
}

function onlyFinalReport(report: {
  patientStatusNote: string | null;
  mainProblems: string | null;
  currentMedication: string | null;
  interventionsProvided: string | null;
  carePlan: string | null;
  finalText: string | null;
}) {
  const structuredEmpty = ![
    report.patientStatusNote,
    report.mainProblems,
    report.currentMedication,
    report.interventionsProvided,
    report.carePlan,
  ].some((v) => v?.trim());
  return structuredEmpty && Boolean(report.finalText?.trim());
}

async function resolvePatient(prisma: PrismaClient, row: LegacyBatch4Visit) {
  return prisma.patient.findMany({
    where: {
      firstName: row.patient.firstName,
      city: row.patient.city,
      ...(row.patient.lastName !== undefined ? { lastName: row.patient.lastName } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      city: true,
      primaryDiagnosis: true,
      secondaryDiagnoses: true,
    },
  });
}

function buildStructured(
  seed: NonNullable<LegacyBatch4Visit["seed"]>,
  diagnosisNote: string | null,
  nurseId: string,
  occurredAt: Date,
) {
  const hebrewText = composeLegacyHebrewReport({
    patientStatusNote: seed.patientStatusNote,
    diagnosisNote,
    mainProblems: seed.mainProblems,
    currentMedication: seed.currentMedication,
    interventionsProvided: seed.interventionsProvided,
    carePlan: seed.carePlan,
  });
  return {
    status: "VALIDATED" as const,
    patientStatusNote: seed.patientStatusNote,
    drivingRisk: seed.drivingRisk,
    diagnosisNote,
    mainProblems: seed.mainProblems,
    currentMedication: seed.currentMedication,
    interventionsProvided: seed.interventionsProvided,
    carePlan: seed.carePlan,
    aiDraft: hebrewText,
    editedDraft: hebrewText,
    finalText: hebrewText,
    validatedAt: occurredAt,
    validatedById: nurseId,
    provider: "legacy-import",
    model: "manual-he",
    promptVersion: "legacy-batch4-he",
  };
}

export async function importLegacyVisitsBatch4(prisma: PrismaClient) {
  const patientsBefore = await prisma.patient.count();
  const medicationCountBefore = await prisma.medication.count();
  const diagnosisSnapshotBefore = await prisma.patient.findMany({
    select: { id: true, primaryDiagnosis: true, secondaryDiagnoses: true },
  });

  const nurse = await prisma.user.findFirst({
    where: { name: TSABAR_NURSE },
    select: { id: true, name: true },
  });
  if (!nurse) throw new Error(`Utilisateur ${TSABAR_NURSE} introuvable.`);

  const report: Report = {
    patientsBefore,
    patientsAfter: patientsBefore,
    createdVisits: [],
    updatedVisits: [],
    skippedVisits: [],
    ambiguousPatientMatches: [],
    possibleDuplicates: [],
    structuredFieldsUpdated: 0,
    openAiCalls: 0,
    timeConvention: [],
    unresolvedPatients: [],
    unresolvedVisits: [],
    medicationsChanged: false,
    diagnosisPatientChanged: false,
    author: nurse.name,
    dbVerifiedNew: [],
  };

  for (const item of LEGACY_BATCH4_AMBIGUOUS) {
    report.ambiguousPatientMatches.push(
      `${item.code} | ${item.importKey} | ${item.label} — ${item.reason}`,
    );
    report.skippedVisits.push(`${item.importKey} (AMBIGUOUS_PATIENT_MATCH)`);
  }

  for (const row of LEGACY_VISITS_BATCH4) {
    const patients = await resolvePatient(prisma, row);
    if (patients.length === 0) {
      report.unresolvedPatients.push(`${row.importKey} : ${row.patient.label}`);
      report.skippedVisits.push(`${row.importKey} (patient introuvable)`);
      continue;
    }
    if (patients.length > 1) {
      report.ambiguousPatientMatches.push(
        `AMBIGUOUS_PATIENT_MATCH | ${row.importKey} | ${patients.length} patients pour ${row.patient.label}`,
      );
      report.skippedVisits.push(`${row.importKey} (AMBIGUOUS_PATIENT_MATCH)`);
      continue;
    }
    const patient = patients[0]!;

    const occurredAt = occurredAtFor(row.when, row.timeKnown);
    if (!occurredAt) {
      report.unresolvedVisits.push(`${row.importKey} : date invalide`);
      report.skippedVisits.push(`${row.importKey} (date invalide)`);
      continue;
    }
    if (!row.timeKnown && row.mode === "CREATE") {
      report.timeConvention.push(
        `${row.importKey} : heure inconnue — occurredAt=12:00 Asia/Jerusalem (contrainte DateTime, non inventée cliniquement)`,
      );
    }

    const byLegacy = await prisma.visit.findMany({
      where: { notes: noteFor(row.importKey) },
      select: {
        id: true,
        type: true,
        patientId: true,
        notes: true,
        report: {
          select: {
            id: true,
            patientStatusNote: true,
            mainProblems: true,
            currentMedication: true,
            interventionsProvided: true,
            carePlan: true,
            drivingRisk: true,
            finalText: true,
          },
        },
      },
    });

    if (byLegacy.length > 1) {
      report.possibleDuplicates.push(
        `POSSIBLE_DUPLICATE | ${row.importKey} | ${byLegacy.length} visites legacy`,
      );
      report.skippedVisits.push(`${row.importKey} (POSSIBLE_DUPLICATE — non touché)`);
      continue;
    }

    // Visites équivalentes sans legacyId (même patient/jour/type)
    const { start, end } = dayBoundsJerusalem(row.when);
    const sameDay = await prisma.visit.findMany({
      where: {
        patientId: patient.id,
        type: row.type,
        occurredAt: { gte: start ?? undefined, lte: end ?? undefined },
        NOT: { notes: noteFor(row.importKey) },
      },
      select: { id: true, notes: true },
    });
    const orphanSameDay = sameDay.filter(
      (v) => !v.notes?.startsWith(NOTE_PREFIX) || v.notes === null,
    );
    if (orphanSameDay.length > 1) {
      report.possibleDuplicates.push(
        `POSSIBLE_DUPLICATE | ${row.importKey} | ${orphanSameDay.length} visites same-day sans/legacy mixte`,
      );
    }

    if (byLegacy.length === 1) {
      const visit = byLegacy[0]!;
      if (visit.patientId !== patient.id || visit.type !== row.type) {
        report.unresolvedVisits.push(`${row.importKey} : mismatch patient/type`);
        report.skippedVisits.push(`${row.importKey} (mismatch)`);
        continue;
      }

      if (visit.report && structuredComplete(visit.report)) {
        report.skippedVisits.push(`${row.importKey} (déjà complète — aucune modification)`);
        continue;
      }

      // CONTROL / CREATE existante : backfill uniquement si seed + structurés vides
      if (row.seed && visit.report && onlyFinalReport(visit.report)) {
        const diagnosisNote = diagnosisFromPatient(
          patient.primaryDiagnosis,
          patient.secondaryDiagnoses,
        );
        const data = buildStructured(row.seed, diagnosisNote, nurse.id, occurredAt);
        await prisma.clinicalReport.update({
          where: { id: visit.report.id },
          data,
        });
        report.updatedVisits.push(`${row.importKey} → visit=${visit.id} (structurés backfill)`);
        report.structuredFieldsUpdated += 1;
        continue;
      }

      if (row.seed && !visit.report) {
        const diagnosisNote = diagnosisFromPatient(
          patient.primaryDiagnosis,
          patient.secondaryDiagnoses,
        );
        const data = buildStructured(row.seed, diagnosisNote, nurse.id, occurredAt);
        await prisma.clinicalReport.create({
          data: {
            visitId: visit.id,
            templateKey: templateKeyFor(row.type),
            ...data,
          },
        });
        report.updatedVisits.push(`${row.importKey} → visit=${visit.id} (rapport créé)`);
        report.structuredFieldsUpdated += 1;
        continue;
      }

      if (row.mode === "CONTROL") {
        report.skippedVisits.push(
          `${row.importKey} (contrôle — structurés incomplets, pas de seed de backfill)`,
        );
        continue;
      }

      // CREATE mode with incomplete structured — update from seed
      if (row.seed && visit.report) {
        const diagnosisNote = diagnosisFromPatient(
          patient.primaryDiagnosis,
          patient.secondaryDiagnoses,
        );
        const data = buildStructured(row.seed, diagnosisNote, nurse.id, occurredAt);
        await prisma.clinicalReport.update({
          where: { id: visit.report.id },
          data,
        });
        report.updatedVisits.push(`${row.importKey} → visit=${visit.id}`);
        report.structuredFieldsUpdated += 1;
        continue;
      }

      report.skippedVisits.push(`${row.importKey} (état inattendu)`);
      continue;
    }

    // Pas de legacyId — éventuellement rattacher une visite orpheline same-day
    if (orphanSameDay.length === 1 && row.mode === "CREATE" && row.seed) {
      const orphan = orphanSameDay[0]!;
      const diagnosisNote = diagnosisFromPatient(
        patient.primaryDiagnosis,
        patient.secondaryDiagnoses,
      );
      const data = buildStructured(row.seed, diagnosisNote, nurse.id, occurredAt);
      await prisma.visit.update({
        where: { id: orphan.id },
        data: { notes: noteFor(row.importKey) },
      });
      const existingReport = await prisma.clinicalReport.findUnique({
        where: { visitId: orphan.id },
        select: { id: true },
      });
      if (existingReport) {
        await prisma.clinicalReport.update({ where: { id: existingReport.id }, data });
      } else {
        await prisma.clinicalReport.create({
          data: {
            visitId: orphan.id,
            templateKey: templateKeyFor(row.type),
            ...data,
          },
        });
      }
      report.updatedVisits.push(
        `${row.importKey} → visit=${orphan.id} (orpheline rattachée + legacyId)`,
      );
      report.structuredFieldsUpdated += 1;
      continue;
    }

    if (orphanSameDay.length > 1) {
      report.possibleDuplicates.push(
        `POSSIBLE_DUPLICATE | ${row.importKey} | plusieurs orphelines same-day — CREATE bloqué`,
      );
      report.skippedVisits.push(`${row.importKey} (POSSIBLE_DUPLICATE — CREATE bloqué)`);
      continue;
    }

    if (row.mode === "CONTROL") {
      report.skippedVisits.push(`${row.importKey} (contrôle — visite absente, non créée)`);
      continue;
    }

    if (!row.seed) {
      report.skippedVisits.push(`${row.importKey} (CREATE sans seed)`);
      continue;
    }

    const diagnosisNote = diagnosisFromPatient(
      patient.primaryDiagnosis,
      patient.secondaryDiagnoses,
    );
    const data = buildStructured(row.seed, diagnosisNote, nurse.id, occurredAt);
    const created = await prisma.visit.create({
      data: {
        patientId: patient.id,
        type: row.type,
        occurredAt,
        notes: noteFor(row.importKey),
        pipelineStatus: "IDLE",
        report: {
          create: {
            templateKey: templateKeyFor(row.type),
            ...data,
          },
        },
      },
      select: { id: true },
    });

    const check = await prisma.clinicalReport.findUnique({
      where: { visitId: created.id },
      select: {
        patientStatusNote: true,
        drivingRisk: true,
        mainProblems: true,
        currentMedication: true,
        interventionsProvided: true,
        carePlan: true,
        finalText: true,
      },
    });
    const ok =
      check &&
      check.patientStatusNote != null &&
      check.drivingRisk === "NOT_ASSESSED" &&
      check.mainProblems != null &&
      check.currentMedication != null &&
      check.interventionsProvided != null &&
      check.carePlan != null &&
      check.finalText != null;
    if (!ok) {
      report.unresolvedVisits.push(`${row.importKey} : DB verify failed après CREATE`);
    } else {
      report.dbVerifiedNew.push(row.importKey);
    }
    report.createdVisits.push(`${row.importKey} → visit=${created.id}`);
    report.structuredFieldsUpdated += 1;
  }

  const patientsAfter = await prisma.patient.count();
  const medicationCountAfter = await prisma.medication.count();
  const diagnosisSnapshotAfter = await prisma.patient.findMany({
    select: { id: true, primaryDiagnosis: true, secondaryDiagnoses: true },
  });

  report.patientsAfter = patientsAfter;
  report.medicationsChanged = medicationCountBefore !== medicationCountAfter;
  report.diagnosisPatientChanged = diagnosisSnapshotBefore.some((before) => {
    const after = diagnosisSnapshotAfter.find((d) => d.id === before.id);
    return (
      !after ||
      after.primaryDiagnosis !== before.primaryDiagnosis ||
      after.secondaryDiagnoses !== before.secondaryDiagnoses
    );
  });

  return report;
}

function printReport(report: Report) {
  console.info("=== CONTRÔLE FINAL LOT 4 ===");
  console.info(`patientsBefore: ${report.patientsBefore}`);
  console.info(`patientsAfter: ${report.patientsAfter}`);
  console.info(`patientsAfter === patientsBefore: ${report.patientsAfter === report.patientsBefore}`);
  console.info(`createdVisits (${report.createdVisits.length}):`);
  for (const item of report.createdVisits) console.info(`  + ${item}`);
  console.info(`updatedVisits (${report.updatedVisits.length}):`);
  for (const item of report.updatedVisits) console.info(`  ~ ${item}`);
  console.info(`skippedVisits (${report.skippedVisits.length}):`);
  for (const item of report.skippedVisits) console.info(`  = ${item}`);
  console.info(`ambiguousPatientMatches (${report.ambiguousPatientMatches.length}):`);
  for (const item of report.ambiguousPatientMatches) console.info(`  ! ${item}`);
  console.info(`possibleDuplicates (${report.possibleDuplicates.length}):`);
  for (const item of report.possibleDuplicates) console.info(`  ! ${item}`);
  if (!report.possibleDuplicates.length) console.info("  (aucun)");
  console.info(`structuredFieldsUpdated: ${report.structuredFieldsUpdated}`);
  console.info(`openAiCalls: ${report.openAiCalls}`);
  console.info(`Medication Patient modifié: ${report.medicationsChanged ? "OUI" : "NON"}`);
  console.info(`Diagnostic Patient modifié: ${report.diagnosisPatientChanged ? "OUI" : "NON"}`);
  console.info(`DB verify nouvelles visites: ${report.dbVerifiedNew.length}`);
  for (const item of report.dbVerifiedNew) console.info(`  ✓ ${item}`);
  console.info(`Heures inconnues (convention DateTime): ${report.timeConvention.length}`);
  for (const item of report.timeConvention) console.info(`  ~ ${item}`);
  console.info(`Auteur: ${report.author}`);
  if (report.unresolvedPatients.length) {
    console.info("Patients non résolus:");
    for (const item of report.unresolvedPatients) console.info(`  ! ${item}`);
  }
  if (report.unresolvedVisits.length) {
    console.info("Visites problématiques:");
    for (const item of report.unresolvedVisits) console.info(`  ! ${item}`);
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits-batch4.ts")) {
  const prisma = new PrismaClient();
  importLegacyVisitsBatch4(prisma)
    .then(printReport)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "import failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
