export const PROMPT_VERSION = "nursing-report-he-1";

export const REPORT_RULES = [
  "Rédiger en hébreu clinique, par blocs, titre puis phrases sans ligne vide dans le bloc.",
  "Ne pas nier un risque si l’assertion n’est pas explicitly_denied.",
  "Un fait historical ne va pas dans l’état mental du jour.",
  "Un fait uncertain est un point à vérifier, pas une mesure.",
].join(" ");
