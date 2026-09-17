import { PrismaClient } from "@prisma/client";

import {
  LEGACY_HEBREW_BATCH1,
  composeLegacyHebrewReport,
  diagnosisFromPatient,
} from "../prisma/data/legacy-hebrew-batch1";
import { TSABAR_NURSE } from "../prisma/data/tsabar-refoua";

const NOTE_PREFIX = "legacyImport:";

type Report = {
  found: string[];
  updated: string[];
  missing: string[];
  duplicates: string[];
  patientMismatch: string[];
  hebrewFields: string[];
};

function noteFor(key: string) {
  return `${NOTE_PREFIX}${key}`;
}

export async function updateLegacyHebrewBatch1(prisma: PrismaClient) {
  const report: Report = {
    found: [],
    updated: [],
    missing: [],
    duplicates: [],
    patientMismatch: [],
    hebrewFields: [
      "patientStatusNote",
      "drivingRisk",
      "diagnosisNote",
      "mainProblems",
      "currentMedication",
      "interventionsProvided",
      "carePlan",
      "finalText/editedDraft/aiDraft (hébreu composé)",
    ],
  };

  const nurse = await prisma.user.findFirst({
    where: { name: TSABAR_NURSE },
    select: { id: true, name: true },
  });
  if (!nurse) {
    throw new Error(`Utilisateur ${TSABAR_NURSE} introuvable.`);
  }

  const visitCountBefore = await prisma.visit.count();
  const medicationCountBefore = await prisma.medication.count();

  for (const row of LEGACY_HEBREW_BATCH1) {
    const matches = await prisma.visit.findMany({
      where: { notes: noteFor(row.importKey) },
      select: {
        id: true,
        type: true,
        patientId: true,
        patient: {
          select: {
            firstName: true,
            city: true,
            primaryDiagnosis: true,
            secondaryDiagnoses: true,
          },
        },
        report: { select: { id: true, status: true } },
      },
    });

    if (matches.length === 0) {
      report.missing.push(`${row.importKey} (${row.patient.label})`);
      continue;
    }
    if (matches.length > 1) {
      report.duplicates.push(
        `${row.importKey} : ${matches.length} visites avec la même clé legacy`,
      );
      continue;
    }

    const visit = matches[0]!;
    report.found.push(row.importKey);

    if (
      visit.patient.firstName !== row.patient.firstName ||
      visit.patient.city !== row.patient.city ||
      visit.type !== row.type
    ) {
      report.patientMismatch.push(
        `${row.importKey} : patient/type divergents (attendu ${row.patient.label} ${row.type})`,
      );
      continue;
    }

    if (!visit.report) {
      report.missing.push(`${row.importKey} : rapport manquant`);
      continue;
    }

    const diagnosisNote = diagnosisFromPatient(
      visit.patient.primaryDiagnosis,
      visit.patient.secondaryDiagnoses,
    );
    const hebrewText = composeLegacyHebrewReport({
      patientStatusNote: row.patientStatusNote,
      diagnosisNote,
      mainProblems: row.mainProblems,
      currentMedication: row.currentMedication,
      interventionsProvided: row.interventionsProvided,
      carePlan: row.carePlan,
    });

    await prisma.clinicalReport.update({
      where: { id: visit.report.id },
      data: {
        status: "VALIDATED",
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
        validatedById: nurse.id,
        provider: "legacy-import",
        model: "manual-he",
        promptVersion: "legacy-batch1-he",
      },
    });

    const check = await prisma.clinicalReport.findUnique({
      where: { id: visit.report.id },
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
    if (
      !check?.patientStatusNote ||
      !check.mainProblems ||
      !check.currentMedication ||
      !check.interventionsProvided ||
      !check.carePlan ||
      check.drivingRisk !== "NOT_ASSESSED" ||
      !check.finalText
    ) {
      throw new Error(`Écriture structurée incomplète pour ${row.importKey}`);
    }

    report.updated.push(`${row.importKey} → visit=${visit.id}`);
  }

  const visitCountAfter = await prisma.visit.count();
  const medicationCountAfter = await prisma.medication.count();

  return {
    ...report,
    visitsCreated: visitCountAfter - visitCountBefore,
    medicationsChanged: medicationCountAfter !== medicationCountBefore,
    openaiCalled: false,
    author: nurse.name,
  };
}

function printReport(
  report: Awaited<ReturnType<typeof updateLegacyHebrewBatch1>>,
) {
  console.info(`Lot 1 retrouvées: ${report.found.length}`);
  console.info(`Mises à jour: ${report.updated.length}`);
  for (const item of report.updated) console.info(`  ~ ${item}`);
  console.info(`Non retrouvées: ${report.missing.length}`);
  for (const item of report.missing) console.info(`  ! ${item}`);
  console.info(`Doublons: ${report.duplicates.length}`);
  for (const item of report.duplicates) console.info(`  = ${item}`);
  console.info(`Patient/type mismatch: ${report.patientMismatch.length}`);
  for (const item of report.patientMismatch) console.info(`  x ${item}`);
  console.info(`Champs hébreux: ${report.hebrewFields.join(", ")}`);
  console.info(`Nouvelles visites créées: ${report.visitsCreated}`);
  console.info(`Traitements Patient modifiés: ${report.medicationsChanged ? "OUI" : "NON"}`);
  console.info(`OpenAI appelé: ${report.openaiCalled ? "OUI" : "NON"}`);
  console.info(`Auteur validateur: ${report.author}`);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("update-legacy-hebrew.ts")) {
  const prisma = new PrismaClient();
  updateLegacyHebrewBatch1(prisma)
    .then(printReport)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "update failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
