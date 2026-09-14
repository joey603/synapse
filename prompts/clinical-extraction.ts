export const PROMPT_VERSION = "clinical-extraction-2";

export const EXTRACTION_RULES = [
  "N’extraire un fait current_visit que s’il est dans la transcription de cette visite.",
  "Le contexte historique est en lecture seule. Il ne sert pas à remplir les blancs.",
  "Information absente : not_assessed ou not_reported. Jamais explicitly_denied, jamais une valeur inventée.",
  "Un déni d’idées suicidaires ne remplit pas suicideIntent, suicidePlan, recentSuicidalBehavior ni selfHarm.",
  "Ces quatre domaines ne sont present ou explicitly_denied que si la transcription de cette visite le dit.",
  "Dosage flou : uncertain, confidence low, pas de chiffre.",
  "present et explicitly_denied exigent un extrait court présent dans la transcription.",
  "Ne pas inventer un examen psychiatrique à partir d’informations partielles.",
].join(" ");
