import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLES = [
  {
    key: "legacy-2026-09-10-rephael-inperson",
    expectStatus: "מצב הרוח במגמת התייצבות",
  },
  {
    key: "legacy-2026-09-15-alicia-inperson",
    expectStatus: "מצב הרוח יציב ואף מרומם",
  },
  {
    key: "legacy-2026-09-02-jacky-inperson",
    expectStatus: "שיפור חלקי בתסמינים האובססיביים",
  },
  {
    key: "legacy-2026-09-16-ruth-inperson",
    expectStatus: "שיפור קליני חלקי",
  },
  {
    key: "legacy-2026-09-10-sarah-ashdod-inperson",
    expectStatus: "מצב הרוח יציב באופן כללי",
  },
] as const;

async function main() {
  let failed = 0;
  for (const sample of SAMPLES) {
    const visit = await prisma.visit.findFirst({
      where: { notes: `legacyImport:${sample.key}` },
      include: { report: true },
    });
    const r = visit?.report;
    const ok =
      Boolean(r?.patientStatusNote?.includes(sample.expectStatus)) &&
      Boolean(r?.mainProblems?.trim()) &&
      Boolean(r?.currentMedication?.trim()) &&
      Boolean(r?.interventionsProvided?.trim()) &&
      Boolean(r?.carePlan?.trim()) &&
      r?.drivingRisk === "NOT_ASSESSED" &&
      Boolean(r?.finalText?.trim());
    console.info(
      ok ? "OK" : "FAIL",
      sample.key,
      {
        patientStatusNote: r?.patientStatusNote?.slice(0, 50) ?? null,
        mainProblems: Boolean(r?.mainProblems),
        currentMedication: Boolean(r?.currentMedication),
        interventionsProvided: Boolean(r?.interventionsProvided),
        carePlan: Boolean(r?.carePlan),
        drivingRisk: r?.drivingRisk ?? null,
        finalLen: r?.finalText?.length ?? 0,
      },
    );
    if (!ok) failed += 1;
  }
  if (failed > 0) {
    throw new Error(`${failed} vérification(s) échouée(s)`);
  }
  console.info("verify-legacy-structured: ok");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
