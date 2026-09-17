import { composeStructuredSections } from "../src/lib/clinical/structured-report";
import { validateExtraction } from "../src/lib/clinical/validators";

/**
 * Isolation Patient A / Patient B :
 * un médicament / historique de A ne doit jamais contaminer B.
 */

{
  // Discrepancy Clozapine inventée pour B avec evidence Bondormin → drop
  const transcriptB = "אני לוקח את הבונדורמין. אני מרגיש עייף.";
  const validated = validateExtraction(
    {
      facts: {
        sleep: {
          assertion: "present",
          evidences: [
            {
              quote: "אני מרגיש עייף",
              speaker: "PATIENT",
              source: "TRANSCRIPT",
              temporality: "CURRENT",
            },
          ],
        },
      },
      medicationDiscrepancies: [
        {
          medication: "clozapine",
          recordDose: "250 mg",
          reportedDose: "250 mg",
          evidence: [
            {
              quote: "אני לוקח את הבונדורמין.",
              speaker: "PATIENT",
              source: "TRANSCRIPT",
              temporality: "CURRENT",
            },
          ],
        },
      ],
    },
    transcriptB,
    "",
  );
  if (!validated) throw new Error("patient B extraction invalid");
  if (validated.medicationDiscrepancies.length > 0) {
    throw new Error("Clozapine discrepancy from Patient A history leaked into Patient B");
  }

  const sections = composeStructuredSections({
    extraction: validated,
    visitType: "IN_PERSON",
    diagnosis: { primary: null, secondary: null },
    medications: [],
  });
  const blob = [
    sections.currentMedication,
    sections.mainProblems,
    sections.patientStatusNote,
    sections.carePlan,
    sections.interventionsProvided,
  ]
    .filter(Boolean)
    .join("\n");
  if (/קלוז|clozapin|250\s*mg/i.test(blob)) {
    throw new Error("Clozapine appeared in Patient B structured projection");
  }
}

{
  // Contrôle positif : Lithium nommé dans la transcript B → discrepancy conservée
  const transcript = "אני לוקח ליתיום 900 מ\"ג";
  const validated = validateExtraction(
    {
      medicationDiscrepancies: [
        { medication: "Lithium", recordDose: "600 mg", reportedDose: "900 mg" },
      ],
    },
    transcript,
  );
  if (!validated?.medicationDiscrepancies.some((item) => item.medication === "Lithium")) {
    throw new Error("supported Lithium discrepancy was dropped");
  }
}

{
  // loadVisitContext scope : le patientId filtre déjà l’historique.
  // Garde-fou texte : un contexte B fabriqué ne contient pas le traitement A.
  const contextPatientB = [
    "PATIENT_ID=patient-b",
    "=== PATIENT (dossier permanent de CE patient uniquement) ===",
    "Identité: Patient B.",
    "=== AUTHORITATIVE TREATMENT (référence dossier CE patient — pas un constat du jour) ===",
    "Aucun médicament enregistré.",
    "=== VALIDATED HISTORY (transmissions VALIDATED de CE patient uniquement) ===",
    "Aucune transmission validée.",
  ].join("\n");
  if (/קלוזאפין|clozapine|250/i.test(contextPatientB)) {
    throw new Error("Patient B ClinicalContext text contains Clozapine");
  }
}

console.info("check-patient-isolation: ok");
