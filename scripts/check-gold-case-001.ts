import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { evaluateGoldTransmission } from "../fixtures/gold/001/case";
import { validateExtraction } from "../src/lib/clinical/validators";
import { jackyExpectedRawExtraction, JACKY_HAD_TRANSCRIPT } from "../fixtures/transcripts/jacky-had";
import { selectHistory } from "../src/lib/ai/clinical-history";

/**
 * Non-régression offline Gold Case 001 :
 * - fixture extraction / suicidalité
 * - isolation historique Patient A vs B
 * - si last-output-he.txt existe, évalue les marqueurs cliniques
 */

{
  const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
  if (!validated) throw new Error("gold fixture extraction invalid");
  if (validated.facts.suicidality.assertion !== "explicitly_denied") {
    throw new Error("current suicidality denial lost in gold fixture");
  }
}

{
  // Filet déterministe : OpenAI renvoie not_assessed alors que la citation CURRENT existe.
  const validated = validateExtraction(
    {
      facts: {
        suicidality: {
          assertion: "not_assessed",
          evidences: [],
        },
      },
    },
    JACKY_HAD_TRANSCRIPT,
    "",
  );
  if (validated?.facts.suicidality.assertion !== "explicitly_denied") {
    throw new Error("salvage failed: explicit current denial stayed not_assessed");
  }
  const evidence = validated.facts.suicidality.evidences[0];
  if (evidence?.speaker !== "PATIENT" || evidence.source !== "TRANSCRIPT" || evidence.temporality !== "CURRENT") {
    throw new Error("salvage failed: evidence attribution incorrect");
  }
  if (!evidence.quote.includes("מחשבות אובדניות")) {
    throw new Error("salvage failed: quote missing");
  }
}

{
  // Isolation contexte : l’historique A (Clozapine) ne doit pas entrer dans B.
  const historyA = selectHistory(
    [
      {
        text: 'קלוזאפין 250 מ"ג בהתאם למידע המתועד בביקור.',
        at: new Date("2026-09-01T12:00:00.000Z"),
        type: "IN_PERSON",
      },
    ],
    "all_validated",
  );
  const historyB = selectHistory([], "all_validated");
  if (!/קלוזאפין|250/.test(historyA.text)) {
    throw new Error("fixture history A should mention Clozapine");
  }
  if (/קלוזאפין|clozapin|250/.test(historyB.text)) {
    throw new Error("Patient B validated history must not contain Clozapine");
  }
  // Document ClinicalContext B simulé
  const contextB = [
    "PATIENT_ID=patient-b",
    "=== AUTHORITATIVE TREATMENT ===",
    "Aucun médicament enregistré.",
    "=== VALIDATED HISTORY ===",
    historyB.text || "Aucune transmission validée.",
  ].join("\n");
  if (/קלוזאפין|clozapin/i.test(contextB)) {
    throw new Error("Clozapine leaked into Patient B ClinicalContext");
  }
}

const outputPath = join(__dirname, "../fixtures/gold/001/last-output-he.txt");
if (existsSync(outputPath)) {
  const text = readFileSync(outputPath, "utf8");
  const evaluation = evaluateGoldTransmission(text);
  if (!evaluation.ok) {
    console.error("Gold Case 001 last-output failed", evaluation);
    throw new Error(
      `gold-case-001 markers missing=${evaluation.missing.join(",")} invented=${evaluation.invented.join(",")}`,
    );
  }
  console.info(`check-gold-case-001: ok (last-output length=${evaluation.length})`);
} else {
  console.info("check-gold-case-001: ok (fixture/isolation only — run npm run gold:001 pour générer last-output)");
}
