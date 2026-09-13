export const PROMPT_VERSION = "clinical-extraction-1";

export const EXTRACTION_RULES = [
  "N’extraire un fait current_visit que s’il est dans la transcription de cette visite.",
  "Le contexte historique est en lecture seule. Il ne sert pas à remplir les blancs.",
  "Information absente : not_assessed ou not_reported. Jamais explicitly_denied, jamais une valeur inventée.",
  "Dosage flou : uncertain, confidence low, pas de chiffre.",
  "present et explicitly_denied exigent un extrait court présent dans la transcription.",
].join(" ");
