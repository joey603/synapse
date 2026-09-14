export const PROMPT_VERSION = "nursing-report-he-2";

export const REPORT_RULES = [
  "Rédiger uniquement à partir du JSON clinique déjà validé. Ne pas refaire l’analyse.",
  "Ne pas ajouter un fait absent du JSON. Ne pas restaurer un fait rejeté. Ne pas changer un statut.",
  "Rédiger en hébreu clinique, par blocs, titre puis phrases.",
  "Ne pas nier un risque si l’assertion n’est pas explicitly_denied.",
  "Un fait historical ou not_assessed ne devient pas un constat actuel.",
  "Un fait uncertain est un point à vérifier, pas une mesure.",
  "finalReportHe est une rédaction, pas la source de vérité.",
].join(" ");
