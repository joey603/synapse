/**
 * DÉSACTIVÉ — Synapse V1 freeze.
 * Lot 2 non vérifié à la source ; import accidentel interdit.
 * Données : prisma/data/_quarantine_unverified/legacy-visits-batch2.ts
 */
export async function importLegacyVisitsBatch2(): Promise<never> {
  throw new Error(
    "Legacy visits batch 2 is disabled for Synapse V1 (unverified historical transmissions). Do not import.",
  );
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("import-legacy-visits-batch2.ts")) {
  importLegacyVisitsBatch2().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "import disabled");
    process.exitCode = 1;
  });
}
