import type { VisitType } from "@prisma/client";

export type LegacyVisitSeed = {
  importKey: string;
  patient: { firstName: string; city: string; label: string };
  type: VisitType;
  /** Jerusalem wall datetime `YYYY-MM-DDTHH:mm`, or date-only `YYYY-MM-DD` (heure inconnue). */
  when: string;
  timeKnown: boolean;
  text: string;
};

/**
 * Premier lot d’historique clinique legacy (VALIDATED).
 * Textes fournis tels quels — aucune réécriture IA.
 */
export const LEGACY_VISITS_BATCH1: LegacyVisitSeed[] = [
  {
    importKey: "legacy-2026-09-01-alicia-inperson",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod" },
    type: "IN_PERSON",
    when: "2026-09-01T18:00",
    timeKnown: true,
    text: "Amélioration clinique nette. Augmentation de la clozapine à 250 mg. Bonne tolérance rapportée. Absence d’éléments délirants retrouvés lors de la visite et absence d’idées suicidaires rapportées. La patiente envisage une reprise du travail dans environ un mois. Écoute active, renforcement positif et éducation thérapeutique.",
  },
  {
    importKey: "legacy-2026-09-09-alicia-virtual",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod" },
    type: "VIRTUAL",
    when: "2026-09-09T18:00",
    timeKnown: true,
    text: "Entretien virtuel réalisé avec participation de la mère. Maintien de l’amélioration clinique. La patiente poursuit son activité professionnelle. Une évaluation médicale est prévue le 22/09 à Assaf Harofeh. Écoute active, soutien et éducation thérapeutique.",
  },
  {
    importKey: "legacy-2026-09-15-alicia-inperson",
    patient: { firstName: "Alicia", city: "לוד", label: "Alicia — Lod" },
    type: "IN_PERSON",
    when: "2026-09-15T15:00",
    timeKnown: true,
    text: "Visite à domicile frontale à Lod. Gestion avec la mère d’un problème de renouvellement de clozapine. La patiente reçoit actuellement 250 mg mais la mère ne dispose pas encore de la nouvelle prescription médicale. La patiente réalise également une prise de sang hebdomadaire, dont la mère ne comprend pas clairement l’indication. Éducation thérapeutique réalisée et demande d’informer le psychiatre afin que la prescription soit transmise rapidement et d’éviter une rupture de traitement. Alicia continue de travailler. Des examens complémentaires sont prévus à la suite de marqueurs tumoraux positifs. Humeur stable, voire enjouée. Écoute active, renforcement positif et éducation thérapeutique.",
  },

  {
    importKey: "legacy-2026-09-07-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    when: "2026-09-07T19:30",
    timeKnown: true,
    text: "Visite à domicile frontale. Humeur relativement stable. Le patient prépare les fêtes de la nouvelle année. Travail au cours de l’entretien autour de questionnements existentiels, de son identité et de sa place de père. Persistance/réactivation d’une dimension anxieuse. Absence d’idées suicidaires rapportées. Écoute active, soutien et renforcement positif.",
  },
  {
    importKey: "legacy-2026-09-10-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    when: "2026-09-10",
    timeKnown: false,
    text: "Visite à domicile frontale. Le patient a participé à une commission concernant le סל שיקום. Contexte familial stressant avec hospitalisation de sa sœur pour insuffisance cardiaque et nécessité de transfusion de deux unités de sang. Ce contexte réactive une anxiété autour de la perte. L’humeur apparaît néanmoins en voie de stabilisation. Absence d’idées suicidaires rapportées. Le patient maintient une certaine ouverture sociale avec sortie et nouvelle rencontre pouvant prendre une dimension relationnelle. Écoute active, renforcement positif et soutien.",
  },
  {
    importKey: "legacy-2026-09-13-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    when: "2026-09-13T14:30",
    timeKnown: true,
    text: "Pas de changement clinique majeur. Le patient a passé les fêtes de la nouvelle année avec ses enfants. Persistance de difficultés relationnelles avec son ex-femme. Il reste néanmoins très investi auprès de ses enfants. Absence d’idées suicidaires rapportées. Écoute active, soutien et renforcement positif.",
  },
  {
    importKey: "legacy-2026-09-15-rephael-inperson",
    patient: { firstName: "Rephael", city: "נס ציונה", label: "Rephael — Ness Ziona" },
    type: "IN_PERSON",
    when: "2026-09-15T14:00",
    timeKnown: true,
    text: "Amélioration clinique. Le patient entretient une relation susceptible d’évoluer vers une relation romantique avec une amie d’enfance retrouvée récemment. Cette évolution contribue positivement à l’estime de soi. Absence d’idées suicidaires rapportées. Le patient reste très investi et dévoué auprès de ses enfants. Il n’a pas repris d’activité professionnelle. Écoute active, renforcement positif et éducation thérapeutique.",
  },

  {
    importKey: "legacy-2026-09-14-dor-virtual",
    patient: { firstName: "Dor", city: "נס ציונה", label: "Dor — Ness Ziona" },
    type: "VIRTUAL",
    when: "2026-09-14T19:00",
    timeKnown: true,
    text: "Visite virtuelle. Pas de changement clinique important. Le patient semble aller mieux sur le plan physique après un épisode de type rhume. Une précédente visite frontale avait été annulée/non réalisée alors que le soignant l’attendait au domicile de sa mère. Contact virtuel, évaluation clinique et organisation de la prochaine visite frontale.",
  },
  {
    importKey: "legacy-2026-09-16-dor-inperson",
    patient: { firstName: "Dor", city: "נס ציונה", label: "Dor — Ness Ziona" },
    type: "IN_PERSON",
    when: "2026-09-16T13:30",
    timeKnown: true,
    text: "Visite à domicile frontale réalisée au domicile de la mère. Amélioration clinique de l’état général et humeur plus stable. Le patient rapporte des douleurs dorsales. Il indique avoir remboursé une partie de ses dettes, avoir obtenu/acheté son passeport afin de pouvoir voyager et commencer à mettre de l’argent de côté. Ces éléments témoignent d’une reprise de projection et d’organisation personnelle. Absence d’idées suicidaires rapportées. Écoute active, renforcement positif et soutien.",
  },

  {
    importKey: "legacy-2026-09-02-jacky-inperson",
    patient: { firstName: "Jacky", city: "ראשון לציון", label: "Jacky — Rishon Lezion" },
    type: "IN_PERSON",
    when: "2026-09-02T13:30",
    timeKnown: true,
    text: "Visite à domicile frontale. Symptomatologie comportant ruminations et manifestations obsessionnelles avec diminution des comportements de vérification. Bénéfice rapporté sous olanzapine, avec cependant augmentation de l’appétit, sédation et sensation d’instabilité. Contexte de diabète nécessitant vigilance et surveillance métabolique. Antécédents récents de pensées suicidaires comprenant une réflexion autour d’une prise de Bondormin et rédaction d’un testament, nécessitant maintien d’une surveillance du risque. Discordance de dose d’olanzapine rapportée : 2,5 mg versus prescription à 5 mg, à vérifier avec le traitement de référence.",
  },
  {
    importKey: "legacy-2026-09-09-jacky-inperson",
    patient: { firstName: "Jacky", city: "ראשון לציון", label: "Jacky — Rishon Lezion" },
    type: "IN_PERSON",
    when: "2026-09-09T12:30",
    timeKnown: true,
    text: "Visite à domicile frontale. Suivi de la symptomatologie obsessionnelle/ruminative et de l’évolution sous olanzapine. Réduction des vérifications. Surveillance de la tolérance en raison de l’appétit augmenté, de la sédation et de sensations d’instabilité, dans un contexte métabolique nécessitant vigilance. Maintien de l’évaluation du risque suicidaire compte tenu des éléments historiques. Discordance posologique d’olanzapine à maintenir comme point de vérification tant qu’elle n’est pas résolue.",
  },
  {
    importKey: "legacy-2026-09-15-jacky-virtual",
    patient: { firstName: "Jacky", city: "ראשון לציון", label: "Jacky — Rishon Lezion" },
    type: "VIRTUAL",
    when: "2026-09-15T20:00",
    timeKnown: true,
    text: "Visite virtuelle réalisée après le retour du patient de la synagogue. Pas de changement clinique important. Absence d’idées suicidaires verbalisées pendant l’entretien. Écoute active, renforcement positif et éducation thérapeutique. Rendez-vous fixé pour une visite à domicile frontale le lendemain.",
  },

  {
    importKey: "legacy-2026-09-04-ruth-inperson",
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-04",
    timeKnown: false,
    text: "Visite à domicile frontale. Tableau dépressif marqué avec humeur dépressive, anhédonie, baisse de l’énergie et du fonctionnement, troubles du sommeil, diminution de l’appétit, difficultés de concentration et sentiment de désespoir. Pensée organisée, sans élément psychotique retrouvé. Absence d’intention suicidaire ou hétéro-agressive rapportée. Contexte de modification thérapeutique avec transition de Lustral/sertraline vers Viepax 75 mg et utilisation de Clonex avec effet partiel. Écoute active, évaluation clinique, soutien et éducation thérapeutique.",
  },
  {
    importKey: "legacy-2026-09-15-ruth-virtual",
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod" },
    type: "VIRTUAL",
    when: "2026-09-15T17:00",
    timeKnown: true,
    text: "Visite virtuelle. Persistance d’un état dépressif important avec humeur basse, anhédonie, faible énergie et retentissement fonctionnel. Troubles du sommeil importants. Alliance thérapeutique restant partielle. Pensée organisée, sans symptomatologie psychotique rapportée. Absence d’intention suicidaire ou hétéro-agressive rapportée. Le traitement après réévaluation psychiatrique comprend Viepax 75 mg/jour et Clonex 0,5 mg deux fois par jour.",
  },
  {
    importKey: "legacy-2026-09-16-ruth-inperson",
    patient: { firstName: "Ruth", city: "אשדוד", label: "Ruth — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-16T16:00",
    timeKnown: true,
    text: "Visite à domicile frontale en présence du mari. Persistance d’une amélioration partielle mais maintien des signes d’un état dépressif important. Troubles du sommeil majeurs : la patiente se couche vers 02:00–03:00, se lève vers 08:00 pour les enfants puis se recouche jusqu’à environ 12:00–13:00. Éducation thérapeutique approfondie concernant l’importance du sommeil et l’observance thérapeutique. Discussion également avec le mari. Alliance thérapeutique restant partielle. Absence d’idées suicidaires rapportées. Actualisation du programme de soins infirmiers après la visite psychiatrique.",
  },

  {
    importKey: "legacy-2026-09-04-sarah-ashdod-virtual",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "VIRTUAL",
    when: "2026-09-04T16:00",
    timeKnown: true,
    text: "Visite virtuelle. Humeur en voie de stabilisation avec persistance d’une anxiété résiduelle. La première semaine d’études s’est déroulée de façon relativement satisfaisante. Absence d’idées suicidaires rapportées. Lorivan arrêté ; Leponex poursuivi sans modification selon les informations disponibles lors de cette visite. Écoute active, renforcement positif et éducation thérapeutique.",
  },
  {
    importKey: "legacy-2026-09-08-sarah-ashdod-inperson",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-08",
    timeKnown: false,
    text: "Visite à domicile frontale. Patiente moins sédatée, plus calme et plus positive. Elle poursuit des études deux fois par semaine et maintient une certaine activité sociale. Possibilité d’activité professionnelle comme assistante auprès d’enfants. Contact organisé. Pas d’élément psychotique ou catatonique spontané retrouvé au cours de la visite. Écoute active, soutien et renforcement positif.",
  },
  {
    importKey: "legacy-2026-09-10-sarah-ashdod-inperson",
    patient: { firstName: "Sarah", city: "אשדוד", label: "Sarah Hen — Ashdod" },
    type: "IN_PERSON",
    when: "2026-09-10",
    timeKnown: false,
    text: "Visite à domicile frontale. Humeur globalement stable avec persistance d’une composante anxieuse. Bon contact et alliance thérapeutique satisfaisante. La patiente a travaillé dans la journée en remplacement d’une assistante. Absence d’idées suicidaires rapportées et absence de manifestation psychotique ou catatonique retrouvée lors de l’entretien. Écoute active et renforcement positif.",
  },
];

/** Visite explicitement exclue (annulée / non réalisée). */
export const LEGACY_SKIPPED_CANCELLED = [
  {
    patientLabel: "Dor — Ness Ziona",
    reason:
      "Visite frontale antérieure annulée/non réalisée (soignant attendu au domicile de la mère) — non importée comme visite validée.",
  },
];
