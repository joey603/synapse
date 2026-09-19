/**
 * Gardes V1 freeze — contrôles statiques (pas de DB, pas d’OpenAI).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "_quarantine_unverified") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// --- 1. Logs cliniques absents des composants / routes critiques ---
{
  const critical = [
    "src/components/visits/StructuredTransmission.tsx",
    "src/app/(app)/patients/[id]/visits/[visitId]/page.tsx",
  ];
  const forbidden = [
    "patientStatusNote",
    "mainProblems",
    "currentMedication",
    "interventionsProvided",
    "carePlan",
    "finalReportHe",
    "diagnosisNote",
  ];
  for (const file of critical) {
    const src = read(file);
    for (const field of forbidden) {
      if (new RegExp(`console\\.(log|info|debug|warn|error)\\([^)]*${field}`).test(src)) {
        throw new Error(`${file}: clinical field logged (${field})`);
      }
    }
    if (/console\.(log|info|debug)\([\s\S]{0,80}transcript/i.test(src)) {
      throw new Error(`${file}: transcript-like console log`);
    }
  }
}

// --- 2. Lots 2–4 non exécutables via package.json ---
{
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  for (const key of [
    "import:legacy-visits-batch2",
    "import:legacy-visits-batch3",
    "import:legacy-visits-batch4",
  ]) {
    if (pkg.scripts[key]) {
      throw new Error(`package.json still exposes ${key}`);
    }
  }
  if (!pkg.scripts["import:legacy-visits"]) {
    throw new Error("Lot 1 import script missing (import:legacy-visits)");
  }
  for (const batch of [2, 3, 4]) {
    const script = read(`scripts/import-legacy-visits-batch${batch}.ts`);
    if (!/disabled for Synapse V1/i.test(script)) {
      throw new Error(`batch ${batch} import script is not disabled`);
    }
    if (/prisma\.|PrismaClient|LEGACY_VISITS_BATCH/.test(script)) {
      throw new Error(`batch ${batch} import script still touches data/DB`);
    }
  }
  if (!existsSync(join(root, "prisma/data/legacy-visits-batch1.ts"))) {
    throw new Error("Lot 1 data missing");
  }
  for (const batch of [2, 3, 4]) {
    if (existsSync(join(root, `prisma/data/legacy-visits-batch${batch}.ts`))) {
      throw new Error(`batch ${batch} still in active prisma/data`);
    }
    if (!existsSync(join(root, `prisma/data/_quarantine_unverified/legacy-visits-batch${batch}.ts`))) {
      throw new Error(`batch ${batch} missing from quarantine`);
    }
  }
}

// --- 3. Pinhas absent des imports / données cliniques actives ---
{
  const activeRoots = [
    join(root, "src"),
    join(root, "prisma/data"),
    join(root, "scripts"),
    join(root, "fixtures"),
  ];
  const hits: string[] = [];
  for (const base of activeRoots) {
    for (const file of walkTsFiles(base)) {
      // Quarantine already skipped in walk; still skip quarantine path explicitly.
      if (file.includes("_quarantine_unverified")) continue;
      if (file.endsWith("check-v1-freeze-guards.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (/Pinhas|פנחס|pinhas/i.test(text)) {
        hits.push(file.replace(root + "/", ""));
      }
    }
  }
  // Quarantine file must also be free of Pinhas clinical draft.
  const q3 = read("prisma/data/_quarantine_unverified/legacy-visits-batch3.ts");
  if (/Pinhas|פנחס|pinhas|legacy-pinhas/i.test(q3)) {
    hits.push("prisma/data/_quarantine_unverified/legacy-visits-batch3.ts");
  }
  if (hits.length) {
    throw new Error(`Pinhas still present in: ${hits.join(", ")}`);
  }
}

// --- 4. Modèle clinique : pas de fallback gpt-4.1-mini silencieux ---
{
  const openai = read("src/lib/ai/openai.ts");
  const models = read("src/lib/ai/models.ts");
  if (/AI_CLINICAL_MODEL\s*\|\|\s*["']gpt-4\.1-mini["']/.test(openai)) {
    throw new Error("openai.ts still falls back silently to gpt-4.1-mini");
  }
  if (!/Missing required environment variable: AI_CLINICAL_MODEL/.test(models)) {
    throw new Error("production guard for AI_CLINICAL_MODEL missing");
  }
  if (!/getClinicalModel/.test(openai)) {
    throw new Error("openai.ts must use getClinicalModel()");
  }
}

// --- 5. Helper tech-log présent ---
{
  if (!existsSync(join(root, "src/lib/tech-log.ts"))) {
    throw new Error("tech-log helper missing");
  }
}

console.info("check-v1-freeze-guards: ok");
