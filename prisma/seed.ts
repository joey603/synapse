import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";
import { importTsabarPatients } from "../scripts/import-tsabar";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD;
  const name = process.env.DEMO_USER_NAME?.trim() || "Infirmier démo";

  if (!email || !password || password.length < 12) {
    throw new Error("DEMO_USER_EMAIL et DEMO_USER_PASSWORD (12 caractères minimum) sont requis.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "NURSE" },
    create: { email, name, passwordHash, role: "NURSE" },
  });

  console.info("Compte de démonstration prêt.");
  const imported = await importTsabarPatients(prisma);
  console.info(`Liste Tsabar: ${imported.created.length} créés, ${imported.updated.length} mis à jour, ${imported.unchanged.length} inchangés.`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "seed failed";
    console.error(message.includes("password") ? "Seed impossible." : message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
