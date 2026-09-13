import "server-only";

import { db } from "@/lib/db";

export async function loadVisitContext(patientId: string, visitId: string) {
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: {
      firstName: true,
      lastName: true,
      birthDate: true,
      city: true,
      primaryDiagnosis: true,
      currentSummary: true,
      riskFactors: true,
      protectiveFactors: true,
      medications: { where: { active: true }, select: { name: true, dose: true, frequency: true } },
    },
  });
  if (!patient) return { text: "", medicationNames: [] as string[] };

  const previous = await db.clinicalReport.findMany({
    where: {
      status: "VALIDATED",
      finalText: { not: null },
      visit: { patientId, id: { not: visitId } },
    },
    orderBy: { validatedAt: "desc" },
    take: 2,
    select: { finalText: true, validatedAt: true },
  });

  const lines = [
    `Identité dossier: ${patient.firstName} ${patient.lastName}, ${patient.city ?? "ville non renseignée"}.`,
    patient.primaryDiagnosis ? `Diagnostic enregistré, historique: ${patient.primaryDiagnosis}` : null,
    patient.currentSummary ? `Résumé saisi par le professionnel, historique: ${truncate(patient.currentSummary)}` : null,
    patient.riskFactors ? `Facteurs de risque du dossier, historique: ${truncate(patient.riskFactors)}` : null,
    patient.protectiveFactors ? `Facteurs protecteurs du dossier, historique: ${truncate(patient.protectiveFactors)}` : null,
    patient.medications.length
      ? `Traitements actifs enregistrés, pas « dit aujourd’hui »: ${patient.medications.map((item) => item.name).join(", ")}`
      : null,
    ...previous.map(
      (report) => `Transmission validée ${report.validatedAt?.toISOString().slice(0, 10) ?? ""}: ${truncate(report.finalText ?? "")}`,
    ),
  ].filter(Boolean);

  return {
    text: lines.join("\n"),
    medicationNames: patient.medications.map((item) => item.name),
  };
}

function truncate(value: string) {
  return value.trim().slice(0, 800);
}
