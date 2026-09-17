import { PrismaClient } from "@prisma/client";

import {
  LEGACY_VISITS_BATCH2,
  composeLegacyHebrewReport,
  diagnosisFromPatient,
} from "../prisma/data/legacy-visits-batch2";
import { TSABAR_NURSE } from "../prisma/data/tsabar-refoua";
import { templateKeyFor } from "../src/lib/clinical/templates";
import { parseJerusalemInput } from "../src/lib/visits/time";

const NOTE_PREFIX = "legacyImport:";

type Report = {
  patients: Set<string>;
  created: string[];
  updated: string[];
  skippedOk: string[];
  unresolvedPatients: string[];
  unresolvedVisits: string[];
  timeConvention: string[];
  structuredVerified: number;
  openaiCalled: false;
};

function noteFor(key: string) {
  return `${NOTE_PREFIX}${key}`;
}

function occurredAtFor(when: string, timeKnown: boolean) {
  const value = timeKnown ? when : `${when}T12:00`;
  return parseJerusalemInput(value);
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

export async function importLegacyVisitsBatch2(prisma: PrismaClient) {
  const report: Report = {
    patients: new Set(),
    created: [],
    updated: [],
    skippedOk: [],
    unresolvedPatients: [],
    unresolvedVisits: [],
    timeConvention: [],
    structuredVerified: 0,
    openaiCalled: false,
  };

  const nurse = await prisma.user.findFirst({
    where: { name: TSABAR_NURSE },
    select: { id: true, name: true },
  });
  if (!nurse) {
    throw new Error(`Utilisateur ${TSABAR_NURSE} introuvable.`);
  }

  const medicationCountBefore = await prisma.medication.count();
  const visitCountBefore = await prisma.visit.count();

  for (const row of LEGACY_VISITS_BATCH2) {
    const patients = await prisma.patient.findMany({
      where: {
        firstName: row.patient.firstName,
        city: row.patient.city,
      },
      select: {
        id: true,
        firstName: true,
        city: true,
        primaryDiagnosis: true,
        secondaryDiagnoses: true,
      },
    });

    if (patients.length === 0) {
      report.unresolvedPatients.push(`${row.importKey} : ${row.patient.label}`);
      continue;
    }
    if (patients.length > 1) {
      report.unresolvedPatients.push(
        `${row.importKey} : ${patients.length} patients pour ${row.patient.label}`,
      );
      continue;
    }
    const patient = patients[0]!;
    report.patients.add(row.patient.label);

    const occurredAt = occurredAtFor(row.when, row.timeKnown);
    if (!occurredAt) {
      report.unresolvedVisits.push(`${row.importKey} : date invalide`);
      continue;
    }
    if (!row.timeKnown) {
      report.timeConvention.push(
        `${row.importKey} : heure inconnue → 12:00 Asia/Jerusalem (Visit.occurredAt exige un DateTime)`,
      );
    }

    const diagnosisNote = diagnosisFromPatient(
      patient.primaryDiagnosis,
      patient.secondaryDiagnoses,
    );
    const hebrewText = composeLegacyHebrewReport({
      patientStatusNote: row.patientStatusNote,
      diagnosisNote,
      mainProblems: row.mainProblems,
      currentMedication: row.currentMedication,
      interventionsProvided: row.interventionsProvided,
      carePlan: row.carePlan,
    });

    const structuredData = {
      status: "VALIDATED" as const,
      patientStatusNote: row.patientStatusNote,
      drivingRisk: row.drivingRisk,
      diagnosisNote,
      mainProblems: row.mainProblems,
      currentMedication: row.currentMedication,
      interventionsProvided: row.interventionsProvided,
      carePlan: row.carePlan,
      aiDraft: hebrewText,
      editedDraft: hebrewText,
      finalText: hebrewText,
      validatedAt: occurredAt,
      validatedById: nurse.id,
      provider: "legacy-import",
      model: "manual-he",
      promptVersion: "legacy-batch2-he",
    };

    const existing = await prisma.visit.findMany({
      where: { notes: noteFor(row.importKey) },
      select: {
        id: true,
        type: true,
        patientId: true,
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

    if (existing.length > 1) {
      report.unresolvedVisits.push(
        `${row.importKey} : ${existing.length} doublons legacy — non touché`,
      );
      continue;
    }

    if (existing.length === 1) {
      const visit = existing[0]!;
      if (visit.patientId !== patient.id || visit.type !== row.type) {
        report.unresolvedVisits.push(
          `${row.importKey} : mismatch patient/type sur visite existante`,
        );
        continue;
      }
      if (!visit.report) {
        await prisma.clinicalReport.create({
          data: {
            visitId: visit.id,
            templateKey: templateKeyFor(row.type),
            ...structuredData,
          },
        });
      } else if (structuredComplete(visit.report)) {
        // Déjà complet — idempotent no-op (sauf refresh texte si demandé : on update quand même pour cohérence)
        await prisma.clinicalReport.update({
          where: { id: visit.report.id },
          data: structuredData,
        });
        report.skippedOk.push(`${row.importKey} (déjà présente, champs rafraîchis)`);
      } else {
        await prisma.clinicalReport.update({
          where: { id: visit.report.id },
          data: structuredData,
        });
        report.updated.push(`${row.importKey} → visit=${visit.id}`);
      }

      const check = await prisma.clinicalReport.findUnique({
        where: { visitId: visit.id },
        select: {
          patientStatusNote: true,
          mainProblems: true,
          currentMedication: true,
          interventionsProvided: true,
          carePlan: true,
          drivingRisk: true,
          finalText: true,
        },
      });
      if (check && structuredComplete(check)) report.structuredVerified += 1;
      else {
        report.unresolvedVisits.push(`${row.importKey} : champs structurés incomplets après update`);
      }
      continue;
    }

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
            ...structuredData,
          },
        },
      },
      select: { id: true },
    });

    const check = await prisma.clinicalReport.findUnique({
      where: { visitId: created.id },
      select: {
        patientStatusNote: true,
        mainProblems: true,
        currentMedication: true,
        interventionsProvided: true,
        carePlan: true,
        drivingRisk: true,
        finalText: true,
      },
    });
    if (!check || !structuredComplete(check)) {
      report.unresolvedVisits.push(`${row.importKey} : création sans champs structurés complets`);
      continue;
    }
    report.structuredVerified += 1;
    report.created.push(`${row.importKey} → visit=${created.id}`);
  }

  const medicationCountAfter = await prisma.medication.count();
  const visitCountAfter = await prisma.visit.count();

  return {
    ...report,
    patientsCount: report.patients.size,
    patientsList: [...report.patients],
    visitsCreatedNet: visitCountAfter - visitCountBefore,
    medicationsChanged: medicationCountAfter !== medicationCountBefore,
    author: nurse.name,
  };
}

function printReport(report: Awaited<ReturnType<typeof importLegacyVisitsBatch2>>) {
  console.info(`Patients concernés: ${report.patientsCount}`);
  for (const label of report.patientsList) console.info(`  • ${label}`);
  console.info(`Visites créées: ${report.created.length}`);
  for (const item of report.created) console.info(`  + ${item}`);
  console.info(`Visites mises à jour: ${report.updated.length}`);
  for (const item of report.updated) console.info(`  ~ ${item}`);
  console.info(`Déjà présentes (rafraîchies): ${report.skippedOk.length}`);
  for (const item of report.skippedOk) console.info(`  = ${item}`);
  console.info(`Patients non retrouvés: ${report.unresolvedPatients.length}`);
  for (const item of report.unresolvedPatients) console.info(`  ! ${item}`);
  console.info(`Visites non importées / problèmes: ${report.unresolvedVisits.length}`);
  for (const item of report.unresolvedVisits) console.info(`  ! ${item}`);
  console.info(`Convention horaire: ${report.timeConvention.length}`);
  for (const item of report.timeConvention) console.info(`  ~ ${item}`);
  console.info(`Champs structurés vérifiés: ${report.structuredVerified}`);
  console.info(`Delta visits DB: ${report.visitsCreatedNet}`);
  console.info(`Traitements Patient modifiés: ${report.medicationsChanged ? "OUI" : "NON"}`);
  console.info(`OpenAI appelé: ${report.openaiCalled ? "OUI" : "NON"}`);
  console.info(`Auteur: ${report.author}`);
  console.info(`Diagnostics inventés: NON (dossier Patient uniquement, souvent null)`);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits-batch2.ts")) {
  const prisma = new PrismaClient();
  importLegacyVisitsBatch2(prisma)
    .then(printReport)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "import failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
