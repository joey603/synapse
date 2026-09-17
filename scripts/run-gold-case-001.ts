import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { openaiClinical } from "../src/lib/ai/openai";
import { coerceExtraction } from "../src/lib/clinical/schema";
import { validateExtraction } from "../src/lib/clinical/validators";
import { JACKY_SUICIDE_DENIAL_QUOTE } from "../fixtures/transcripts/jacky-had";
import {
  GOLD_CASE_001,
  evaluateGoldTransmission,
} from "../fixtures/gold/001/case";
import { CLINICAL_REPORT_PROMPT_VERSION } from "../prompts/clinical-report";
import { loadEnvFile } from "./_load-env";

async function main() {
  loadEnvFile();

  const outDir = join(__dirname, "../fixtures/gold/001");
  mkdirSync(outDir, { recursive: true });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing — cannot run live Gold Case 001");
  }

  const model = process.env.AI_CLINICAL_MODEL || "gpt-4.1-mini";
  console.info(`Gold Case 001 · prompt=${CLINICAL_REPORT_PROMPT_VERSION} · model=${model}`);

  // --- Diagnostic suicidalité A→G ---
  console.info("\n===== DIAGNOSTIC SUICIDALITÉ A→G =====\n");
  console.info("A. Quote in transcript:", JACKY_SUICIDE_DENIAL_QUOTE);
  console.info("   present?", GOLD_CASE_001.transcript.includes(JACKY_SUICIDE_DENIAL_QUOTE));

  const raw = await openaiClinical.extract({
    transcript: GOLD_CASE_001.transcript,
    context: GOLD_CASE_001.isolatedContext,
  });
  const coerced = coerceExtraction(raw);
  if (!coerced) throw new Error("Gold Case 001: coerceExtraction failed");

  const before = coerced.facts.suicidality;
  console.info(
    "E. clinical fact AVANT validation:",
    JSON.stringify(
      {
        assertion: before.assertion,
        evidences: before.evidences,
        evidence: before.evidence,
        temporality: before.temporality,
        source: before.source,
      },
      null,
      2,
    ),
  );

  const validated = validateExtraction(raw, GOLD_CASE_001.transcript, "");
  if (!validated) throw new Error("Gold Case 001: validation failed");
  const after = validated.facts.suicidality;
  const primary = after.evidences.find(
    (item) => item.speaker === "PATIENT" && item.temporality === "CURRENT" && item.source === "TRANSCRIPT",
  );
  console.info("B. speaker:", primary?.speaker ?? after.evidences[0]?.speaker ?? null);
  console.info("C. source:", primary?.source ?? after.evidences[0]?.source ?? null);
  console.info("D. temporality:", primary?.temporality ?? after.evidences[0]?.temporality ?? null);
  console.info(
    "F. clinical fact APRÈS validation:",
    JSON.stringify(
      {
        assertion: after.assertion,
        evidences: after.evidences,
        evidence: after.evidence,
        temporality: after.temporality,
        source: after.source,
      },
      null,
      2,
    ),
  );

  if (after.assertion !== "explicitly_denied") {
    throw new Error("Gold Case 001: suicidality must be explicitly_denied after validation salvage");
  }
  if (!primary) {
    throw new Error("Gold Case 001: missing PATIENT/CURRENT/TRANSCRIPT suicidality evidence after validation");
  }

  const written = await openaiClinical.writeReport({
    extraction: validated,
    transcript: GOLD_CASE_001.transcript,
    context: GOLD_CASE_001.isolatedContext,
    visitType: "IN_PERSON",
    occurredAt: new Date("2026-09-16T10:00:00.000Z"),
    patientName: "Patient B",
  });

  const text = written.text.trim();
  if (!text) throw new Error("Gold Case 001: empty transmission");

  console.info(
    "G. valeur utilisée pour finalReportHe (suicidality JSON + citation attendue):",
    JSON.stringify(
      {
        assertion: after.assertion,
        quote: after.evidence?.quote ?? primary.quote,
        speaker: primary.speaker,
        source: primary.source,
        temporality: primary.temporality,
        reportSuicideSnippet: text.match(/.{0,40}אובדנ.{0,80}/)?.[0] ?? null,
      },
      null,
      2,
    ),
  );

  const evaluation = evaluateGoldTransmission(text);
  const meta = {
    id: GOLD_CASE_001.id,
    promptVersion: CLINICAL_REPORT_PROMPT_VERSION,
    model: written.model,
    length: evaluation.length,
    missing: evaluation.missing,
    invented: evaluation.invented,
    ok: evaluation.ok,
    sexFromRecord: GOLD_CASE_001.sex,
    suicidalityTrace: {
      beforeAssertion: before.assertion,
      afterAssertion: after.assertion,
      speaker: primary.speaker,
      source: primary.source,
      temporality: primary.temporality,
      quote: primary.quote,
      lossStage:
        before.assertion === "not_assessed" || before.assertion === "not_reported"
          ? "OpenAI extraction (salvaged by deterministic validator)"
          : before.assertion === after.assertion
            ? "none"
            : "deterministic validators",
    },
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(join(outDir, "last-output-he.txt"), `${text}\n`, "utf8");
  writeFileSync(join(outDir, "last-meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  writeFileSync(
    join(outDir, "last-suicidality-trace.json"),
    `${JSON.stringify(meta.suicidalityTrace, null, 2)}\n`,
    "utf8",
  );

  console.info("\n===== META =====\n");
  console.info(JSON.stringify(meta, null, 2));
  console.info("\n===== TRANSMISSION HEBRAIQUE =====\n");
  console.info(text);
  console.info("\n===== FIN =====\n");

  if (!evaluation.ok) {
    console.error("Gold Case 001 FAILED", { missing: evaluation.missing, invented: evaluation.invented });
    process.exitCode = 1;
    return;
  }
  console.info("Gold Case 001 PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
