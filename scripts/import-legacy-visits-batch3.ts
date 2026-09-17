import { PrismaClient } from "@prisma/client";

import {
  LEGACY_BATCH3_MISSING_PATIENTS,
  LEGACY_VISITS_BATCH3,
  composeLegacyHebrewReport,
  diagnosisFromPatient,
  type LegacyBatch3Visit,
} from "../prisma/data/legacy-visits-batch3";
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
  duplicates: string[];
  timeConvention: string[];
  structuredVerified: number;
  hebrewVerified: number;
  finalReportVerified: number;
  openaiCalled: false;
};

function noteFor(key: string) {
  return `${NOTE_PREFIX}${key}`;
}

function occurredAtFor(when: string, timeKnown: boolean) {
  const value = timeKnown ? when : `${when}T12:00`;
  return parseJerusalemInput(value);
}

function hasHebrew(text: string | null | undefined) {
  return Boolean(text && /[\u0590-\u05FF]/.test(text));
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

async function resolvePatient(
  prisma: PrismaClient,
  row: LegacyBatch3Visit,
) {
  const patients = await prisma.patient.findMany({
    where: {
      firstName: row.patient.firstName,
      city: row.patient.city,
      ...(row.patient.lastName ? { lastName: row.patient.lastName } : {}),
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
  return patients;
}

export async function importLegacyVisitsBatch3(prisma: PrismaClient) {
  const report: Report = {
    patients: new Set(),
    created: [],
    updated: [],
    skippedOk: [],
    unresolvedPatients: [],
    unresolvedVisits: [],
    duplicates: [],
    timeConvention: [],
    structuredVerified: 0,
    hebrewVerified: 0,
    finalReportVerified: 0,
    openaiCalled: false,
  };

  for (const missing of LEGACY_BATCH3_MISSING_PATIENTS) {
    report.unresolvedPatients.push(`${missing.importKey} : ${missing.label} — ${missing.reason}`);
  }

  const nurse = await prisma.user.findFirst({
    where: { name: TSABAR_NURSE },
    select: { id: true, name: true },
  });
  if (!nurse) {
    throw new Error(`Utilisateur ${TSABAR_NURSE} introuvable.`);
  }

  const medicationCountBefore = await prisma.medication.count();
  const visitCountBefore = await prisma.visit.count();

  for (const row of LEGACY_VISITS_BATCH3) {
    const patients = await resolvePatient(prisma, row);

    if (patients.length === 0) {
      report.unresolvedPatients.push(`${row.importKey} : ${row.patient.label}`);
      continue;
    }
    if (patients.length > 1) {
      report.duplicates.push(
        `${row.importKey} : ${patients.length} patients pour ${row.patient.label}`,
      );
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
        `${row.importKey} : heure inconnue — occurredAt=12:00 Asia/Jerusalem (contrainte DateTime, heure non inventée comme donnée clinique)`,
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
      promptVersion: "legacy-batch3-he",
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
      report.duplicates.push(
        `${row.importKey} : ${existing.length} doublons legacy — non touché`,
      );
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

      if (row.controlOnly) {
        if (visit.report && structuredComplete(visit.report)) {
          report.skippedOk.push(`${row.importKey} (contrôle Lot 1 — déjà complète, non modifiée)`);
          report.structuredVerified += 1;
          if (hasHebrew(visit.report.finalText)) report.hebrewVerified += 1;
          if (visit.report.finalText?.trim()) report.finalReportVerified += 1;
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
          report.updated.push(`${row.importKey} → visit=${visit.id} (contrôle : rapport créé)`);
        } else {
          await prisma.clinicalReport.update({
            where: { id: visit.report.id },
            data: structuredData,
          });
          report.updated.push(`${row.importKey} → visit=${visit.id} (contrôle : champs structurés complétés)`);
        }
      } else if (!visit.report) {
        await prisma.clinicalReport.create({
          data: {
            visitId: visit.id,
            templateKey: templateKeyFor(row.type),
            ...structuredData,
          },
        });
        report.updated.push(`${row.importKey} → visit=${visit.id}`);
      } else if (structuredComplete(visit.report)) {
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
      if (check && structuredComplete(check)) {
        report.structuredVerified += 1;
        if (hasHebrew(check.finalText) && hasHebrew(check.patientStatusNote)) {
          report.hebrewVerified += 1;
        }
        if (check.finalText?.trim()) report.finalReportVerified += 1;
      } else {
        report.unresolvedVisits.push(`${row.importKey} : champs structurés incomplets après update`);
      }
      continue;
    }

    // Pas de visite existante
    if (row.controlOnly) {
      report.skippedOk.push(
        `${row.importKey} (contrôle Lot 1 — visite absente, non créée)`,
      );
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
    if (hasHebrew(check.finalText) && hasHebrew(check.patientStatusNote)) {
      report.hebrewVerified += 1;
    }
    if (check.finalText?.trim()) report.finalReportVerified += 1;
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

function printReport(report: Awaited<ReturnType<typeof importLegacyVisitsBatch3>>) {
  console.info("=== CONTRÔLE FINAL LOT 3 ===");
  console.info(`1. Patients retrouvés (${report.patientsCount}):`);
  for (const label of report.patientsList) console.info(`  • ${label}`);
  console.info(`2. Visites nouvelles créées (${report.created.length}):`);
  for (const item of report.created) console.info(`  + ${item}`);
  console.info(`3. Visites existantes mises à jour (${report.updated.length}):`);
  for (const item of report.updated) console.info(`  ~ ${item}`);
  console.info(`4. Visites ignorées / déjà correctes (${report.skippedOk.length}):`);
  for (const item of report.skippedOk) console.info(`  = ${item}`);
  console.info(`5. Patients non retrouvés (${report.unresolvedPatients.length}):`);
  for (const item of report.unresolvedPatients) console.info(`  ! ${item}`);
  console.info(`6. Doublons détectés (${report.duplicates.length}):`);
  for (const item of report.duplicates) console.info(`  ! ${item}`);
  if (report.duplicates.length === 0) console.info("  (aucun)");
  console.info(`7. Champs structurés vérifiés: ${report.structuredVerified}`);
  console.info(`8. Textes hébreu vérifiés: ${report.hebrewVerified}`);
  console.info(`9. finalReport présent: ${report.finalReportVerified}`);
  console.info("10. Diagnostics inventés: NON (dossier Patient uniquement)");
  console.info(`11. Medication Patient modifié: ${report.medicationsChanged ? "OUI" : "NON"}`);
  console.info(`12. OpenAI appelé: ${report.openaiCalled ? "OUI" : "NON"}`);
  console.info(`13. Heures inconnues (convention DateTime 12:00 JLM, non inventées cliniquement): ${report.timeConvention.length}`);
  for (const item of report.timeConvention) console.info(`  ~ ${item}`);
  console.info(`Auteur: ${report.author}`);
  console.info(`Delta visits DB: ${report.visitsCreatedNet}`);
  if (report.unresolvedVisits.length) {
    console.info(`Autres problèmes (${report.unresolvedVisits.length}):`);
    for (const item of report.unresolvedVisits) console.info(`  ! ${item}`);
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits-batch3.ts")) {
  const prisma = new PrismaClient();
  importLegacyVisitsBatch3(prisma)
    .then(printReport)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "import failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
