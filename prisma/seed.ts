import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

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
  await seedPatients();
}

async function seedPatients() {
  const files = [
    {
      phone: "052-000-1001",
      firstName: "Noa",
      lastName: "Levi",
      birthDate: date("1988-04-12"),
      sex: "FEMALE" as const,
      city: "Jérusalem",
      address: "Rue fictive 12",
      contactName: "David Levi",
      contactPhone: "052-000-1101",
      insurer: "Clalit",
      referringPsychiatrist: "Dr. Fictif Amar",
      referringNurse: "Infirmier démo",
      admittedAt: date("2026-03-02"),
      status: "ACTIVE" as const,
      primaryDiagnosis: "Épisode dépressif, dossier de démonstration",
      secondaryDiagnoses: "Insomnie",
      psychHistory: "Suivi ambulatoire fictif depuis 2024. Aucune hospitalisation réelle.",
      somaticHistory: "Hypertension traitée, données fictives.",
      suicideHistory: "Non renseigné dans ce dossier de démonstration.",
      addictions: "Tabac, sevrage en cours — fiction.",
      allergies: "Aucune connue",
      riskFactors: "Isolement relatif",
      protectiveFactors: "Soutien familial, observance habituelle",
      currentSummary:
        "Dossier fictif. Humeur basse stable depuis la dernière visite de démonstration. Sommeil fragmenté. Pas d’urgence rapportée dans ce jeu de données.",
      meds: [{ name: "Escitalopram", dose: "10 mg", frequency: "1×/j", route: "PO" }],
    },
    {
      phone: "052-000-1002",
      firstName: "Eitan",
      lastName: "Cohen",
      birthDate: date("1975-11-03"),
      sex: "MALE" as const,
      city: "Tel Aviv",
      address: "Rue fictive 4",
      contactName: "Ruth Cohen",
      contactPhone: "052-000-1102",
      insurer: "Maccabi",
      referringPsychiatrist: "Dr. Fictif Bar",
      referringNurse: "Infirmier démo",
      admittedAt: date("2025-11-18"),
      status: "ACTIVE" as const,
      primaryDiagnosis: "Schizophrénie, dossier de démonstration",
      secondaryDiagnoses: null,
      psychHistory: "HAD fictive. Pas d’hospitalisation récente dans ce jeu de données.",
      somaticHistory: "Surpoids.",
      suicideHistory: "Non abordé dans les notes de démonstration.",
      addictions: "Aucune rapportée",
      allergies: "Pénicilline — fiction",
      riskFactors: "Observance irrégulière signalée comme donnée fictive",
      protectiveFactors: "Logement stable, suivi rapproché",
      currentSummary:
        "Dossier fictif. Contact présent, discours cohérent dans les notes de démo. Traitement poursuivi. À relire, ceci n’est pas un cas réel.",
      meds: [{ name: "Olanzapine", dose: "10 mg", frequency: "soir", route: "PO" }],
    },
    {
      phone: "052-000-1003",
      firstName: "Maya",
      lastName: "Biton",
      birthDate: date("1992-06-21"),
      sex: "FEMALE" as const,
      city: "Haïfa",
      address: "Rue fictive 9",
      contactName: "Yael Biton",
      contactPhone: "052-000-1103",
      insurer: "Meuhedet",
      referringPsychiatrist: "Dr. Fictif Dan",
      referringNurse: "Infirmier démo",
      admittedAt: date("2026-01-14"),
      status: "ACTIVE" as const,
      primaryDiagnosis: "Trouble bipolaire, dossier de démonstration",
      secondaryDiagnoses: "Anxiété",
      psychHistory: "Deux épisodes fictifs, sans donnée réelle.",
      somaticHistory: "Aucun antécédent notable dans la démo.",
      suicideHistory: "Non renseigné dans ce dossier de démonstration.",
      addictions: "Aucune",
      allergies: "Aucune connue",
      riskFactors: "Variation de sommeil",
      protectiveFactors: "Travail à temps partiel, suivi psychiatrique",
      currentSummary:
        "Dossier fictif. Sommeil raccourci cette semaine dans le scénario de démo. Pas d’agitation décrite. Résumé manuel, non généré.",
      meds: [
        { name: "Lithium", dose: "400 mg", frequency: "2×/j", route: "PO" },
        { name: "Lorazépam", dose: "1 mg", frequency: "si besoin", route: "PO" },
      ],
    },
    {
      phone: "052-000-1004",
      firstName: "Yossi",
      lastName: "Avraham",
      birthDate: date("1968-01-30"),
      sex: "MALE" as const,
      city: "Beer-Sheva",
      address: "Rue fictive 21",
      contactName: "Hanna Avraham",
      contactPhone: "052-000-1104",
      insurer: "Leumit",
      referringPsychiatrist: "Dr. Fictif Eli",
      referringNurse: "Infirmier démo",
      admittedAt: date("2025-06-01"),
      status: "INACTIVE" as const,
      primaryDiagnosis: "État de stress post-traumatique, dossier de démonstration",
      secondaryDiagnoses: null,
      psychHistory: "Suivi clos dans le scénario de démonstration.",
      somaticHistory: "Douleurs lombaires.",
      suicideHistory: "Non renseigné.",
      addictions: "Alcool occasionnel — fiction",
      allergies: "Aucune connue",
      riskFactors: "Isolement",
      protectiveFactors: "Conjoint présent",
      currentSummary: "Dossier fictif inactif. Conservé pour tester le filtre « Tous ».",
      meds: [] as Array<{ name: string; dose: string; frequency: string; route: string }>,
    },
    {
      phone: "052-000-1005",
      firstName: "Sarah",
      lastName: "Mizrahi",
      birthDate: date("1981-09-09"),
      sex: "FEMALE" as const,
      city: "Netanya",
      address: "Rue fictive 7",
      contactName: "Eli Mizrahi",
      contactPhone: "052-000-1105",
      insurer: "Clalit",
      referringPsychiatrist: "Dr. Fictif Noam",
      referringNurse: "Infirmier démo",
      admittedAt: date("2026-02-20"),
      status: "ACTIVE" as const,
      primaryDiagnosis: "Trouble anxieux, dossier de démonstration",
      secondaryDiagnoses: "Attaques de panique décrites dans la fiction",
      psychHistory: "Premier suivi HAD fictif.",
      somaticHistory: "Asthme léger.",
      suicideHistory: "Non renseigné dans ce dossier de démonstration.",
      addictions: "Aucune",
      allergies: "AINS — fiction",
      riskFactors: "Évitement des sorties",
      protectiveFactors: "Enfants au domicile, demande d’aide claire",
      currentSummary:
        "Dossier fictif. Anxiété fluctuante, sorties limitées dans le scénario. Traitement poursuivi. À utiliser uniquement pour tester l’application.",
      meds: [{ name: "Sertraline", dose: "50 mg", frequency: "matin", route: "PO" }],
    },
  ];

  for (const file of files) {
    const { meds, ...data } = file;
    const existing = await prisma.patient.findFirst({
      where: { phone: data.phone },
      select: { id: true },
    });
    const patient = existing
      ? await prisma.patient.update({ where: { id: existing.id }, data })
      : await prisma.patient.create({ data });

    await prisma.medication.deleteMany({ where: { patientId: patient.id } });
    if (meds.length > 0) {
      await prisma.medication.createMany({
        data: meds.map((med) => ({ ...med, patientId: patient.id, active: true })),
      });
    }
  }

  console.info("Cinq patients fictifs prêts.");
}

function date(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
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
