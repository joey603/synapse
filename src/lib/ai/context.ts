import "server-only";

import { db } from "@/lib/db";
import { selectHistory, type HistoryMode } from "@/lib/ai/clinical-history";

export type { HistoryMode };
export { selectHistory };

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
      sex: true,
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
    `PATIENT_ID=${patientId}`,
    "=== PATIENT (dossier permanent de CE patient uniquement) ===",
    `Identité: ${patient.firstName} ${patient.lastName}.`,
    grammaticalSexLine(patient.sex),
    line("Diagnostic enregistré", patient.primaryDiagnosis),
    line("Diagnostics associés", patient.secondaryDiagnoses),
    line("Résumé clinique du dossier", patient.currentSummary),
    line("Contexte psychosocial", [patient.psychHistory, patient.somaticHistory, patient.addictions].filter(Boolean).join(" ")),
    line("Antécédents suicidaires du dossier", patient.suicideHistory),
    line("Facteurs de risque du dossier", patient.riskFactors),
    line("Facteurs protecteurs du dossier", patient.protectiveFactors),
    "",
    "=== AUTHORITATIVE TREATMENT (référence dossier CE patient — pas un constat du jour) ===",
    "N’invente aucune medicationDiscrepancy à partir de cette liste si le médicament n’est pas nommé dans la transcription / notes actuelles.",
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
    "=== VALIDATED HISTORY (transmissions VALIDATED de CE patient uniquement) ===",
    "Contexte d’évolution seulement. NE PAS traiter comme constat d’aujourd’hui. Interdit de réutiliser un médicament historique comme divergence du jour sans mention actuelle.",
    history.text || "Aucune transmission validée.",
    "",
    "=== CURRENT VISIT (métadonnées + Nurse Note ; la transcription suit séparément) ===",
    "Seule source, avec la transcription, pour affirmer ce qui est rapporté, nié, observé ou évalué aujourd’hui.",
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

function grammaticalSexLine(sex: string) {
  if (sex === "MALE") {
    return [
      "Sexe enregistré (dossier Patient.sex): MALE",
      "GENRE GRAMMATICAL OBLIGATOIRE: masculin uniquement (המטופל, הוא, אמר, מסר, תיאר, נוטל, היה).",
      "INTERDIT: המטופלת, היא, אמרה, תיארה, et toute forme barrée המטופל/ת / מסר/ה / תיאר/ה / נוטל/ת.",
      "Ne pas inférer le genre depuis le prénom, la transcription, les partenaires mentionnés, ni l’historique textuel.",
    ].join("\n");
  }
  if (sex === "FEMALE") {
    return [
      "Sexe enregistré (dossier Patient.sex): FEMALE",
      "GENRE GRAMMATICAL OBLIGATOIRE: féminin uniquement (המטופלת, היא, אמרה, מסרה, תיארה, נוטלת, הייתה).",
      "INTERDIT: המטופל (masculin), הוא, אמר, תיאר, et toute forme barrée המטופל/ת / מסר/ה / תיאר/ה / נוטל/ת.",
      "Ne pas inférer le genre depuis le prénom, la transcription, les partenaires mentionnés, ni l’historique textuel.",
    ].join("\n");
  }
  return [
    `Sexe enregistré (dossier Patient.sex): ${sex}`,
    "GENRE GRAMMATICAL: sexe non précisé dans le dossier — formulations masculines génériques cliniques PLEINES (המטופל, מסר, תיאר, נוטל).",
    "INTERDIT ABSOLU: המטופל/ת, מסר/ה, תיאר/ה, נוטל/ת, וא/ה, מצדו/ה (formes barrées).",
    "Interdit d’inférer un genre depuis le prénom, la transcription, les partenaires mentionnés, ou l’historique textuel.",
    "Interdit de féminiser automatiquement (המטופלת) sans Patient.sex=FEMALE.",
  ].join("\n");
}

function line(label: string, value: string | null | undefined) {
  const text = value?.trim();
  return text ? `${label}: ${text}` : null;
}
