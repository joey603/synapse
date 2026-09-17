import { PrismaClient } from "@prisma/client";

import {
  LEGACY_SKIPPED_CANCELLED,
  LEGACY_VISITS_BATCH1,
  type LegacyVisitSeed,
} from "../prisma/data/legacy-visits-batch1";
import { templateKeyFor } from "../src/lib/clinical/templates";
import { parseJerusalemInput } from "../src/lib/visits/time";
import { TSABAR_NURSE } from "../prisma/data/tsabar-refoua";

const NOTE_PREFIX = "legacyImport:";

type Report = {
  created: string[];
  skippedDuplicate: string[];
  unresolved: string[];
  timeConvention: string[];
  excludedCancelled: string[];
};

function noteFor(key: string) {
  return `${NOTE_PREFIX}${key}`;
}

function occurredAtFor(row: LegacyVisitSeed): Date | null {
  const value = row.timeKnown ? row.when : `${row.when}T12:00`;
  return parseJerusalemInput(value);
}

export async function importLegacyVisitsBatch1(prisma: PrismaClient) {
  const report: Report = {
    created: [],
    skippedDuplicate: [],
    unresolved: [],
    timeConvention: [],
    excludedCancelled: LEGACY_SKIPPED_CANCELLED.map(
      (item) => `${item.patientLabel} : ${item.reason}`,
    ),
  };

  const nurse = await prisma.user.findFirst({
    where: { name: TSABAR_NURSE },
    select: { id: true },
  });
  if (!nurse) {
    throw new Error(`Utilisateur ${TSABAR_NURSE} introuvable. Import legacy arrêté.`);
  }

  for (const row of LEGACY_VISITS_BATCH1) {
    const patients = await prisma.patient.findMany({
      where: {
        firstName: row.patient.firstName,
        city: row.patient.city,
      },
      select: { id: true, firstName: true, lastName: true, city: true, address: true },
    });

    if (patients.length === 0) {
      report.unresolved.push(`${row.importKey} : aucun patient ${row.patient.label}`);
      continue;
    }
    if (patients.length > 1) {
      report.unresolved.push(
        `${row.importKey} : ${patients.length} patients pour ${row.patient.label} — non importé (homonymes).`,
      );
      continue;
    }
    const patient = patients[0]!;

    const existing = await prisma.visit.findFirst({
      where: { notes: noteFor(row.importKey) },
      select: { id: true },
    });
    if (existing) {
      report.skippedDuplicate.push(`${row.importKey} (${row.patient.label})`);
      continue;
    }

    const occurredAt = occurredAtFor(row);
    if (!occurredAt) {
      report.unresolved.push(`${row.importKey} : date/heure invalide « ${row.when} »`);
      continue;
    }
    if (!row.timeKnown) {
      report.timeConvention.push(
        `${row.importKey} : heure inconnue → convention 12:00 Asia/Jerusalem (le modèle Visit.occurredAt exige un DateTime).`,
      );
    }

    const visit = await prisma.visit.create({
      data: {
        patientId: patient.id,
        type: row.type,
        occurredAt,
        notes: noteFor(row.importKey),
        pipelineStatus: "IDLE",
        report: {
          create: {
            status: "VALIDATED",
            templateKey: templateKeyFor(row.type),
            provider: "legacy-import",
            model: "manual",
            promptVersion: "legacy-batch1",
            aiDraft: row.text,
            editedDraft: row.text,
            finalText: row.text,
            validatedAt: occurredAt,
            validatedById: nurse.id,
          },
        },
      },
      select: { id: true },
    });

    report.created.push(
      `${row.importKey} → ${row.patient.label} (${row.type}) visit=${visit.id}`,
    );
  }

  return report;
}

function printReport(report: Report) {
  console.info(`Créées: ${report.created.length}`);
  for (const item of report.created) console.info(`  + ${item}`);
  console.info(`Doublons évités: ${report.skippedDuplicate.length}`);
  for (const item of report.skippedDuplicate) console.info(`  = ${item}`);
  console.info(`Non rattachées: ${report.unresolved.length}`);
  for (const item of report.unresolved) console.info(`  ! ${item}`);
  console.info(`Convention horaire: ${report.timeConvention.length}`);
  for (const item of report.timeConvention) console.info(`  ~ ${item}`);
  console.info(`Exclues (annulées/non réalisées): ${report.excludedCancelled.length}`);
  for (const item of report.excludedCancelled) console.info(`  - ${item}`);
  console.info(
    `Patients distincts créés dans ce lot: ${new Set(report.created.map((line) => line.split("→")[1]?.split("(")[0]?.trim()).filter(Boolean)).size}`,
  );
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits.ts")) {
  const prisma = new PrismaClient();
  importLegacyVisitsBatch1(prisma)
    .then(printReport)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "import failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
