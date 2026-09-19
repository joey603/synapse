/**
 * DÉSACTIVÉ — Synapse V1 freeze.
 * Lot 4 non vérifié à la source ; import accidentel interdit.
 * Données : prisma/data/_quarantine_unverified/legacy-visits-batch4.ts
 */
export async function importLegacyVisitsBatch4(): Promise<never> {
  throw new Error(
    "Legacy visits batch 4 is disabled for Synapse V1 (unverified historical transmissions). Do not import.",
  );
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits-batch4.ts")) {
  importLegacyVisitsBatch4().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "import disabled");
    process.exitCode = 1;
  });
}
