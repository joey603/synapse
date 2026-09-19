import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getClinicalModel } from "../src/lib/ai/models";
import { openaiClinical } from "../src/lib/ai/openai";
import { coerceExtraction } from "../src/lib/clinical/schema";
import { validateExtraction } from "../src/lib/clinical/validators";
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

  const model = getClinicalModel();
  console.info(`Gold Case 001 · prompt=${CLINICAL_REPORT_PROMPT_VERSION} · model=${model}`);

  const raw = await openaiClinical.extract({
    transcript: GOLD_CASE_001.transcript,
    context: GOLD_CASE_001.isolatedContext,
  });
  const coerced = coerceExtraction(raw);
  if (!coerced) throw new Error("Gold Case 001: coerceExtraction failed");

  const before = coerced.facts.suicidality;
  const validated = validateExtraction(raw, GOLD_CASE_001.transcript, "");
  if (!validated) throw new Error("Gold Case 001: validation failed");
  const after = validated.facts.suicidality;
  const primary = after.evidences.find(
    (item) => item.speaker === "PATIENT" && item.temporality === "CURRENT" && item.source === "TRANSCRIPT",
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
      // quote écrit uniquement dans le fichier de trace — pas en console
      quotePresent: Boolean(primary.quote),
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
    `${JSON.stringify(
      {
        ...meta.suicidalityTrace,
        quote: primary.quote,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  // Console : métadonnées techniques uniquement (pas de transmission / citations).
  console.info(
    JSON.stringify(
      {
        ok: evaluation.ok,
        length: evaluation.length,
        missingCount: evaluation.missing.length,
        inventedCount: evaluation.invented.length,
        model: written.model,
        promptVersion: CLINICAL_REPORT_PROMPT_VERSION,
      },
      null,
      2,
    ),
  );

  if (!evaluation.ok) {
    console.error("Gold Case 001 FAILED", {
      missingCount: evaluation.missing.length,
      inventedCount: evaluation.invented.length,
    });
    process.exitCode = 1;
    return;
  }
  console.info("Gold Case 001 PASSED");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "gold case failed");
  process.exitCode = 1;
});
