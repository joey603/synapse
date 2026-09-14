import { PrismaClient } from "@prisma/client";

import { TSABAR_NURSE, TSABAR_PATIENTS, type TsabarPatient } from "../prisma/data/tsabar-refoua";

const PLANNING = /🏡|☎️|🟢|🔴|🚨|❌|prévu le/i;

type Existing = {
  id: string;
  firstName: string;
  lastName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  contactName: string | null;
  referringNurse: string | null;
};

type Report = {
  created: string[];
  updated: string[];
  unchanged: string[];
  conflicts: string[];
  uncertain: string[];
  historySkipped: string[];
};

export async function importTsabarPatients(prisma: PrismaClient) {
  if (TSABAR_PATIENTS.length !== 40) {
    throw new Error("La liste Tsabar doit contenir 40 patients.");
  }
  const nurse = await prisma.user.findFirst({
    where: { name: TSABAR_NURSE },
    select: { id: true },
  });
  if (!nurse) throw new Error("Utilisateur Ariel Barthel introuvable. Import arrêté.");

  const existing = await prisma.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      city: true,
      address: true,
      phone: true,
      contactName: true,
      referringNurse: true,
    },
  });
  const report: Report = {
    created: [],
    updated: [],
    unchanged: [],
    conflicts: [],
    uncertain: [],
    historySkipped: await importValidatedHistory(prisma, []),
  };

  for (const row of TSABAR_PATIENTS) {
    noteUncertainty(row, report);
    const phoneHit = existing.filter((item) => phonesOverlap(item.phone, row.phones) && !sameIdentity(item, row));
    if (phoneHit.length > 0) {
      report.conflicts.push(`${label(row)} : numéro déjà porté par un autre dossier, non fusionné.`);
      continue;
    }
    const matches = existing.filter((item) => sameIdentity(item, row));
    if (matches.length > 1) {
      report.conflicts.push(`${label(row)} : plusieurs dossiers correspondent, rien n’a été modifié.`);
      continue;
    }
    const note = operationalNote(row);
    if (matches.length === 0) {
      const created = await prisma.patient.create({
        data: {
          firstName: row.firstName,
          lastName: row.lastName,
          city: row.city,
          address: row.address,
          phone: row.phones.length ? row.phones.join(" / ") : null,
          contactName: note,
          referringNurse: TSABAR_NURSE,
          status: "ACTIVE",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          address: true,
          phone: true,
          contactName: true,
          referringNurse: true,
        },
      });
      existing.push(created);
      report.created.push(label(row));
      continue;
    }
    const current = matches[0]!;
    const data: { phone?: string; address?: string; city?: string; contactName?: string; referringNurse?: string } = {};
    fillMissing(current, "phone", row.phones.length ? row.phones.join(" / ") : null, data, report, row);
    fillMissing(current, "address", row.address, data, report, row);
    fillMissing(current, "city", row.city, data, report, row);
    fillMissing(current, "contactName", note, data, report, row);
    fillMissing(current, "referringNurse", TSABAR_NURSE, data, report, row);
    if (Object.keys(data).length === 0) {
      report.unchanged.push(label(row));
      continue;
    }
    await prisma.patient.update({ where: { id: current.id }, data });
    Object.assign(current, data);
    report.updated.push(label(row));
  }

  report.uncertain.push("Rephael et Dor partagent la même adresse à נס ציונה. Ils restent deux dossiers distincts.");
  report.uncertain.push("Le rythme, l’accès et la fin HAD indiquée sont notés dans le champ administratif « personne de contact », faute de champ dédié. Ce n’est pas une donnée clinique.");
  return report;
}

export function rejectPlanningHistory(text: string) {
  return PLANNING.test(text);
}

export async function importValidatedHistory(
  _prisma: PrismaClient,
  items: Array<{ text: string }>,
) {
  const skipped: string[] = [];
  if (items.length === 0) {
    return ["Aucune transmission validée fournie. Aucune visite créée."];
  }
  for (const item of items) {
    if (!item.text.trim() || rejectPlanningHistory(item.text)) {
      skipped.push("Texte de planning ou vide ignoré. Aucune visite clinique créée.");
    }
  }
  if (skipped.length === items.length) return skipped;
  skipped.push("Historique fourni mais non importé : le rattachement n’est pas encore validé dans cette liste.");
  return skipped;
}

function noteUncertainty(row: TsabarPatient, report: Report) {
  for (const phone of row.phones) {
    if (phone.replace(/\D/g, "").length < 10) {
      report.uncertain.push(`${label(row)} : un numéro a moins de 10 chiffres, conservé tel quel, sans correction.`);
    }
  }
  if (row.phones.length === 0) {
    report.uncertain.push(`${label(row)} : aucun téléphone fourni.`);
  }
  if (row.firstName === "Neiman" && !row.lastName) {
    report.uncertain.push("Neiman : un seul nom fourni. Rangé comme prénom, nom de famille laissé vide.");
  }
}

function sameIdentity(existing: Existing, row: TsabarPatient) {
  if (existing.firstName !== row.firstName || (existing.lastName ?? "") !== row.lastName) return false;
  if ((existing.city ?? "") !== row.city) return false;
  if (row.phones.length === 0) return (existing.address ?? "") === row.address && !existing.phone;
  if (!existing.phone) return (existing.address ?? "") === row.address;
  return phonesOverlap(existing.phone, row.phones);
}

function phonesOverlap(stored: string | null, incoming: string[]) {
  const left = digits(stored);
  if (left.length === 0 || incoming.length === 0) return false;
  return incoming.some((phone) => left.includes(phone.replace(/\D/g, "")));
}

function digits(value: string | null) {
  return (value ?? "").split(/[^\d]+/).filter((item) => item.length >= 8);
}

function fillMissing(
  current: Existing,
  field: "phone" | "address" | "city" | "contactName" | "referringNurse",
  incoming: string | null,
  data: Record<string, string>,
  report: Report,
  row: TsabarPatient,
) {
  if (!incoming) return;
  const stored = current[field]?.trim() ?? "";
  if (!stored) {
    data[field] = incoming;
    return;
  }
  if (stored !== incoming) {
    report.conflicts.push(`${label(row)} : ${field} déjà renseigné autrement, valeur existante conservée.`);
  }
}

function operationalNote(row: TsabarPatient) {
  return [
    row.access ? `Accès: ${row.access}` : null,
    `Rythme: ${row.frequency}`,
    row.operations,
  ]
    .filter(Boolean)
    .join(". ");
}

function label(row: TsabarPatient) {
  return [row.ref, row.firstName, row.lastName, row.city].filter(Boolean).join(" ");
}

function printReport(report: Report) {
  console.info(`Créés: ${report.created.length}`);
  for (const item of report.created) console.info(`  + ${item}`);
  console.info(`Mis à jour: ${report.updated.length}`);
  for (const item of report.updated) console.info(`  ~ ${item}`);
  console.info(`Inchangés: ${report.unchanged.length}`);
  console.info(`Conflits: ${report.conflicts.length}`);
  for (const item of report.conflicts) console.info(`  ! ${item}`);
  console.info("À valider humainement:");
  for (const item of report.uncertain) console.info(`  ? ${item}`);
  console.info("Historique clinique:");
  for (const item of report.historySkipped) console.info(`  - ${item}`);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-tsabar.ts")) {
  const prisma = new PrismaClient();
  importTsabarPatients(prisma)
    .then(printReport)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "import failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
