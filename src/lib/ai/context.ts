import "server-only";

import { db } from "@/lib/db";

const HISTORY_LIMIT = 24000;

export type HistoryMode = "all_validated";

export async function loadVisitContext(patientId: string, visitId: string) {
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: {
      // Administratif / opérationnel HAD volontairement absent : téléphone, adresse,
      // ville, codes d’accès, étage/appartement, accessInstructions, rythme
      // hebdomadaire, contact, caisse. Jamais envoyé au modèle clinique.
      firstName: true,
      lastName: true,
      birthDate: true,
      primaryDiagnosis: true,
      secondaryDiagnoses: true,
      currentSummary: true,
      psychHistory: true,
      somaticHistory: true,
      suicideHistory: true,
      addictions: true,
      riskFactors: true,
      protectiveFactors: true,
      currentTreatmentNote: true,
      medications: {
        select: { name: true, dose: true, frequency: true, active: true, note: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!patient) return { text: "", medicationNames: [] as string[] };

  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { occurredAt: true, type: true, notes: true },
  });

  const previous = await db.clinicalReport.findMany({
    where: {
      status: "VALIDATED",
      finalText: { not: null },
      visit: { patientId, id: { not: visitId } },
    },
    orderBy: { validatedAt: "asc" },
    select: { finalText: true, validatedAt: true, visit: { select: { occurredAt: true, type: true } } },
  });

  const history = selectHistory(
    previous.map((report) => ({
      text: report.finalText ?? "",
      at: report.visit.occurredAt,
      type: report.visit.type,
    })),
    "all_validated",
  );

  const lines = [
    "PATIENT",
    `Identité: ${patient.firstName} ${patient.lastName}.`,
    line("Diagnostic enregistré", patient.primaryDiagnosis),
    line("Diagnostics associés", patient.secondaryDiagnoses),
    line("Résumé clinique du dossier", patient.currentSummary),
    line("Contexte psychosocial", [patient.psychHistory, patient.somaticHistory, patient.addictions].filter(Boolean).join(" ")),
    line("Antécédents suicidaires du dossier", patient.suicideHistory),
    line("Facteurs de risque du dossier", patient.riskFactors),
    line("Facteurs protecteurs du dossier", patient.protectiveFactors),
    "",
    "TRAITEMENT ENREGISTRÉ — RÉFÉRENCE DU DOSSIER, PAS UN CONSTAT DU JOUR",
    patient.medications.length
      ? patient.medications
          .map((item) =>
            [
              item.name,
              item.dose,
              item.frequency,
              item.active ? "actif" : "arrêté",
              item.note,
            ]
              .filter(Boolean)
              .join(" · "),
          )
          .join("\n")
      : "Aucun médicament enregistré.",
    line("Note de traitement", patient.currentTreatmentNote),
    "",
    "HISTORIQUE — TRANSMISSIONS VALIDÉES UNIQUEMENT. NE PAS LES TRAITER COMME LE CONSTAT D’AUJOURD’HUI.",
    history.text || "Aucune transmission validée.",
    "",
    "VISITE ACTUELLE — SEULE SOURCE POUR AFFIRMER CE QUI EST RAPPORTÉ, NIÉ, OBSERVÉ OU ÉVALUÉ AUJOURD’HUI.",
    visit
      ? `Date: ${visit.occurredAt.toISOString().slice(0, 10)}. Type: ${visit.type}.`
      : null,
    line("Notes infirmières de cette visite", visit?.notes),
  ].filter((item) => item != null);

  return {
    text: lines.join("\n"),
    medicationNames: patient.medications.filter((item) => item.active).map((item) => item.name),
  };
}

export function selectHistory(
  reports: Array<{ text: string; at: Date; type: string }>,
  mode: HistoryMode,
) {
  if (mode !== "all_validated") return { text: "", omitted: 0 };
  const ordered = [...reports].sort((a, b) => a.at.getTime() - b.at.getTime());
  const kept: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const report of [...ordered].reverse()) {
    const block = `HISTORIQUE ${report.at.toISOString().slice(0, 10)} (${report.type})\n${report.text.trim()}`;
    if (used + block.length > HISTORY_LIMIT && kept.length > 0) {
      omitted += 1;
      continue;
    }
    kept.push(block);
    used += block.length;
  }
  const note = omitted > 0 ? `Des transmissions validées plus anciennes ont été omises (${omitted}).\n` : "";
  return { text: note + kept.reverse().join("\n\n"), omitted };
}

function line(label: string, value: string | null | undefined) {
  const text = value?.trim();
  return text ? `${label}: ${text}` : null;
}
