/**
 * DÉSACTIVÉ — Synapse V1 freeze.
 * Lot 3 non vérifié à la source ; import accidentel interdit.
 * Données : prisma/data/_quarantine_unverified/legacy-visits-batch3.ts
 */
export async function importLegacyVisitsBatch3(): Promise<never> {
  throw new Error(
    "Legacy visits batch 3 is disabled for Synapse V1 (unverified historical transmissions). Do not import.",
  );
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits-batch3.ts")) {
  importLegacyVisitsBatch3().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "import disabled");
    process.exitCode = 1;
  });
}
