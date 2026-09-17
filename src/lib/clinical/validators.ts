import { coerceExtraction } from "@/lib/clinical/schema";
import { hebrewClinicalText } from "@/lib/clinical/hebrew-text";
import {
  FACT_DOMAINS,
  RISK_DOMAINS,
  emptyFact,
  type ClinicalFact,
  type EvidenceItem,
  type Evolution,
  type FactDomain,
  type MedicationDiscrepancy,
  type StoredExtraction,
} from "@/lib/clinical/types";
import { currentQuote } from "@/lib/clinical/types";

const DOCUMENTED = new Set(["present", "explicitly_denied"]);
const TRAJECTORY = new Set<Evolution>(["improved", "worsened", "stable", "new", "resolved"]);

export function validateExtraction(
  raw: unknown,
  transcript: string,
  nurseNotes = "",
): StoredExtraction | null {
  const coerced = coerceExtraction(raw);
  if (!coerced) return null;

  const downgraded: string[] = [];
  const points = [...coerced.pointsToVerify];
  const facts = {} as Record<FactDomain, ClinicalFact>;

  for (const domain of FACT_DOMAINS) {
    facts[domain] = applyRules(coerced.facts[domain], transcript, nurseNotes, domain, downgraded);
  }

  // Filet déterministe : une négation CURRENT explicite présente dans la transcription
  // ne doit jamais rester not_assessed (perte OpenAI fréquente sur suicidality).
  salvageExplicitRiskDenials(facts, transcript);
  // Filet déterministe : domaines cliniques clairement cités ne doivent pas rester vides
  // lorsque OpenAI les a laissés not_assessed (projection Zebra patientStatusNote / mainProblems).
  salvageDocumentedClinicalFacts(facts, transcript);

  let medicationMentions = coerced.medicationMentions.map((fact, index) =>
    applyRules(fact, transcript, nurseNotes, `medication:${index}`, downgraded, true),
  );
  medicationMentions = salvageMedicationMentions(medicationMentions, transcript);

  const interventions = keepCited(coerced.interventions, transcript, nurseNotes);
  const plan = keepCited(coerced.plan, transcript, nurseNotes);
  const contradictions = keepContradictions(coerced.contradictions, transcript, nurseNotes, points);
  const medicationDiscrepancies = keepDiscrepancies(
    coerced.medicationDiscrepancies,
    transcript,
    nurseNotes,
  );

  const partial: Pick<
    StoredExtraction,
    "facts" | "medicationMentions" | "interventions" | "plan" | "contradictions" | "medicationDiscrepancies"
  > = {
    facts,
    medicationMentions,
    interventions,
    plan,
    contradictions,
    medicationDiscrepancies,
  };

  const longitudinal = gateLongitudinal(coerced.longitudinal, facts);
  if (
    facts.suicidality.assertion === "explicitly_denied" &&
    detectSuicidalityImprovement(transcript) &&
    (!longitudinal.suicidality || longitudinal.suicidality === "not_reassessed")
  ) {
    longitudinal.suicidality = "improved";
  }

  // Evidence CURRENT validée invalide tout warning affirmant que la même evidence est absente.
  const prunedPoints = pruneIncompatiblePoints(points, facts);

  return {
    facts,
    medicationMentions,
    changes: [],
    reviewFlags: [],
    downgraded,
    longitudinal,
    interventions,
    plan,
    contradictions,
    medicationDiscrepancies,
    pointsToVerify: prunedPoints.slice(0, 12),
    suggestedTasks: keepSuggestedTasks(coerced.suggestedTasks, transcript, nurseNotes, partial),
    finalReportHe: coerced.finalReportHe,
  };
}

function applyRules(
  fact: ClinicalFact,
  transcript: string,
  nurseNotes: string,
  key: string,
  downgraded: string[],
  medication = false,
): ClinicalFact {
  const evidences = fact.evidences.filter((item) => quoteFound(item, transcript, nurseNotes));
  const current = evidences.filter((item) => item.temporality === "CURRENT");
  const assertion = fact.assertion;

  if (assertion === "not_assessed" || assertion === "not_reported") {
    return finish({ ...fact, evidences, evidence: null }, medication);
  }

  if (assertion === "present" || assertion === "explicitly_denied") {
    const support = current.filter((item) => supports(assertion, item, key));
    if (support.length === 0) {
      downgraded.push(key);
      return finish({
        ...fact,
        assertion: "uncertain",
        value: null,
        evidence: null,
        evidences,
        confidence: "low",
        temporality: "unknown",
      }, medication);
    }
  }

  const quote = current[0]?.quote ?? null;
  return finish({
    ...fact,
    evidences,
    evidence: quote ? { quote } : null,
    temporality: current.length > 0 ? "current_visit" : fact.temporality,
    // Conserver SourceKind tel quel — ne jamais mapper NURSE_NOTE → « transcript ».
    // La provenance documentaire reste dans evidences[].source (TRANSCRIPT | NURSE_NOTE).
    source: fact.source,
  }, medication);
}

function supports(assertion: ClinicalFact["assertion"], item: EvidenceItem, key: string) {
  if (assertion !== "explicitly_denied") return true;
  if (isRiskKey(key)) return item.speaker === "PATIENT";
  return item.speaker === "PATIENT" || item.speaker === "NURSE";
}

function isRiskKey(key: string) {
  return (RISK_DOMAINS as readonly string[]).includes(key);
}

function finish(fact: ClinicalFact, medication: boolean): ClinicalFact {
  const next = stripLooseDose(
    {
      ...fact,
      // Ne pas persister de résumés anglais dans value (UI Analyse / Zebra).
      value: hebrewClinicalText(fact.value),
    },
    medication,
  );
  if (!next.evidence && currentQuote(next)) {
    return { ...next, evidence: { quote: currentQuote(next)! } };
  }
  return next;
}

function gateLongitudinal(
  proposed: Partial<Record<FactDomain, Evolution>>,
  facts: Record<FactDomain, ClinicalFact>,
) {
  const next: Partial<Record<FactDomain, Evolution>> = {};
  for (const domain of FACT_DOMAINS) {
    const value = proposed[domain];
    if (!value) continue;
    const documented = DOCUMENTED.has(facts[domain].assertion);
    if (!documented && TRAJECTORY.has(value)) {
      next[domain] = "not_reassessed";
      continue;
    }
    next[domain] = value;
  }
  return next;
}

function keepCited(
  items: StoredExtraction["interventions"],
  transcript: string,
  nurseNotes: string,
) {
  return items
    .map((item) => ({ ...item, evidence: item.evidence.filter((proof) => quoteFound(proof, transcript, nurseNotes)) }))
    .filter((item) => item.text && item.evidence.length > 0);
}

function keepContradictions(
  items: StoredExtraction["contradictions"],
  transcript: string,
  nurseNotes: string,
  points: string[],
) {
  const kept = [];
  for (const item of items) {
    const evidence = item.evidence.filter((proof) => quoteFound(proof, transcript, nurseNotes));
    if (evidence.length === 0) {
      points.push(item.summary);
      continue;
    }
    // Exiger deux preuves ancrées + assertions réellement incompatibles (même objet / temporalité).
    if (evidence.length < 2 || isNonContradiction(item.summary, evidence)) {
      continue;
    }
    kept.push({ ...item, evidence });
  }
  return kept;
}

/**
 * Évolution temporelle ou différence de perception ≠ contradiction clinique.
 * Une contradiction exige deux propositions incompatibles sur le même objet
 * à une temporalité compatible.
 */
function isNonContradiction(summary: string, evidence: EvidenceItem[]) {
  const text = `${summary} ${evidence.map((item) => item.quote).join(" ")}`;

  // Perception relationnelle à T1 vs fin de relation à T2.
  if (
    /תחוש|חשב|מעוניין|משמעותי|רצה|רצוי/.test(text) &&
    /הסתיים|נגמר|לאחר\s+מכן|בסופו|תגובה\s+תוקפ/.test(text)
  ) {
    return true;
  }

  // Temporalités explicitement incompatibles entre les deux preuves.
  const times = new Set(evidence.map((item) => item.temporality));
  if (times.has("HISTORICAL") && times.has("CURRENT") && !/מינון|dose|תרופה|medication/i.test(text)) {
    // Historique vs actuel n’est une contradiction que pour traitements / doses (autre voie).
    if (/השתנה|בעבר|אחר\s+כך|לאחר|היום|כיום/.test(text) || times.size >= 2) {
      // Si le résumé décrit une évolution plutôt qu’une incompatibilité synchrone → drop.
      if (/התפתח|השתנה|ואז|לאחר|בסוף|בהמשך/.test(text) || /תחוש|חשב|מעוניין/.test(summary)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Si une evidence CURRENT validée établit une négation explicite,
 * supprimer les pointsToVerify qui affirment que cette négation est absente.
 * Ne supprime pas les autres pointsToVerify.
 */
export function pruneIncompatiblePoints(
  points: string[],
  facts: Record<FactDomain, ClinicalFact>,
): string[] {
  const deniedSuicidality =
    facts.suicidality?.assertion === "explicitly_denied" &&
    facts.suicidality.evidences.some(
      (item) =>
        item.speaker === "PATIENT" &&
        item.temporality === "CURRENT" &&
        (item.source === "TRANSCRIPT" || item.source === "NURSE_NOTE"),
    );

  return points.filter((point) => {
    if (!deniedSuicidality) return true;
    // Warnings affirmant l’absence de négation / d’évaluation explicite — incompatibles.
    if (
      /לא\s+נמסרה\s+שלילה\s+מפורשת|שלילה\s+מפורשת.*לא|אין\s+שלילה\s+מפורשת|לא\s+הוערכ.*אובדנ|אובדנ.*לא\s+נבדק|מאחר\s+שלא\s+נמסרה\s+שלילה|לא\s+תוארו\s+באופן\s+מפורש\s+מחשבות\s+אובדניות/.test(
        point,
      )
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Conserve une divergence médicamenteuse si le médicament / la dose rapportée
 * est ancré(e) dans TRANSCRIPT ou NURSE_NOTE. Une evidence hors sujet (autre molécule)
 * ne suffit pas. Ne résout jamais quelle dose est correcte.
 */
function keepDiscrepancies(
  items: MedicationDiscrepancy[],
  transcript: string,
  nurseNotes: string,
): MedicationDiscrepancy[] {
  return items.flatMap((item) => {
    const medAnchored = medicationAnchoredInSources(item.medication, transcript, nurseNotes);
    const evidence = (item.evidence ?? []).filter((proof) => {
      if (!quoteFound(proof, transcript, nurseNotes)) return false;
      return (
        medicationAnchoredInSources(item.medication, proof.quote, "") ||
        doseNumberInSources(item.reportedDose, proof.quote, "")
      );
    });

    // Exiger un ancrage du médicament dans la visite courante (pas l’historique seul).
    // Une evidence hors sujet (autre molécule) ne sauve pas la discrepancy.
    // Ne pas remonter en pointsToVerify une molécule absente de la visite (fuite d’historique).
    if (!medAnchored && evidence.length === 0) {
      return [];
    }

    return [{
      ...item,
      evidence,
      requiresHumanReview: true as const,
    }];
  });
}

function medicationAnchoredInSources(medication: string, transcript: string, nurseNotes: string) {
  const names = medicationAliases(medication);
  const corpus = `${transcript}\n${nurseNotes}`;
  return names.some((name) => quoteInTranscript(name, corpus) || sharesSignificantToken(name, corpus));
}

function medicationAliases(medication: string) {
  const raw = medication.trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const aliases = new Set<string>([raw, lower]);
  // Formes courantes hébreu / latin pour molécules fréquentes HAD.
  if (/clozapin|קלוזאפין|לפונקס|leponex/i.test(raw)) {
    aliases.add("clozapine");
    aliases.add("קלוזאפין");
    aliases.add("Leponex");
    aliases.add("לפונקס");
  }
  if (/bondormin|בונדורמין|בואנדורמין/i.test(raw)) {
    aliases.add("Bondormin");
    aliases.add("בונדורמין");
  }
  if (/lithium|ליתיום/i.test(raw)) {
    aliases.add("Lithium");
    aliases.add("ליתיום");
  }
  return [...aliases];
}

/**
 * Garde déterministe léger : une suggestedTask n’est conservée que si elle
 * est ancrée dans TRANSCRIPT, NURSE_NOTE, ou un élément déjà validé.
 * Ne crée jamais de Task réelle.
 */
function keepSuggestedTasks(
  tasks: string[],
  transcript: string,
  nurseNotes: string,
  validated: Pick<
    StoredExtraction,
    "facts" | "medicationMentions" | "interventions" | "plan" | "contradictions" | "medicationDiscrepancies"
  >,
): string[] {
  const anchors = collectValidatedAnchors(validated);
  return tasks.filter((task) => {
    if (anchoredInSources(task, transcript, nurseNotes)) return true;
    return anchors.some((anchor) => sharesSignificantToken(task, anchor));
  });
}

function collectValidatedAnchors(
  validated: Pick<
    StoredExtraction,
    "facts" | "medicationMentions" | "interventions" | "plan" | "contradictions" | "medicationDiscrepancies"
  >,
): string[] {
  const anchors: string[] = [];
  for (const domain of FACT_DOMAINS) {
    const fact = validated.facts[domain];
    if (fact.assertion !== "present" && fact.assertion !== "explicitly_denied") continue;
    if (fact.value) anchors.push(fact.value);
    for (const item of fact.evidences) anchors.push(item.quote);
    if (fact.evidence?.quote) anchors.push(fact.evidence.quote);
  }
  for (const fact of validated.medicationMentions) {
    if (fact.value) anchors.push(fact.value);
    for (const item of fact.evidences) anchors.push(item.quote);
  }
  for (const item of validated.interventions) {
    anchors.push(item.text);
    for (const proof of item.evidence) anchors.push(proof.quote);
  }
  for (const item of validated.plan) {
    anchors.push(item.text);
    for (const proof of item.evidence) anchors.push(proof.quote);
  }
  for (const item of validated.contradictions) {
    anchors.push(item.summary);
    for (const proof of item.evidence) anchors.push(proof.quote);
  }
  for (const item of validated.medicationDiscrepancies) {
    anchors.push(item.medication, item.reportedDose);
    if (item.recordDose) anchors.push(item.recordDose);
  }
  return anchors.filter(Boolean);
}

function anchoredInSources(text: string, transcript: string, nurseNotes: string) {
  return quoteInTranscript(text, transcript) || quoteInTranscript(text, nurseNotes) || sharesSignificantToken(text, `${transcript} ${nurseNotes}`);
}

function doseNumberInSources(spoken: string, transcript: string, nurseNotes: string) {
  const number = spoken.match(/\d+/)?.[0];
  if (!number) return false;
  return transcript.includes(number) || nurseNotes.includes(number);
}

function sharesSignificantToken(left: string, right: string) {
  const rightNorm = normalize(right);
  if (!rightNorm) return false;
  const tokens = significantTokens(left);
  if (tokens.length === 0) return false;
  return tokens.some((token) => rightNorm.includes(token));
}

function significantTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4)
    .filter((token) => !STOP_TOKENS.has(token));
}

const STOP_TOKENS = new Set([
  "avec", "sans", "pour", "dans", "cette", "cela", "aussi", "plus", "moins",
  "demander", "suivre", "faire", "avoir", "etre", "être",
  "מעקב", "לבדוק", "לוודא", "לקבוע", "ביצוע", "המשך",
]);

/** Motifs génériques de négation CURRENT de suicidalité (pas de règle patient). */
const SUICIDALITY_CURRENT_DENIAL_RES: RegExp[] = [
  /היום\s+לא\s+הי[וה]\s+לי\s+מחשבות\s+אובדניות/,
  /אין\s+לי\s+מחשבות\s+אובדניות/,
  /אין\s+מחשבות\s+אובדניות/,
  /אני\s+לא\s+חושב(?:ת)?\s+על\s+מוות/,
  /לא\s+הי[וה]\s+לי\s+מחשבות\s+אובדניות/,
];

/**
 * Si OpenAI a perdu une négation CURRENT explicite présente dans la transcription,
 * la reconstruire de façon déterministe (speaker PATIENT, source TRANSCRIPT).
 */
function salvageExplicitRiskDenials(
  facts: Record<FactDomain, ClinicalFact>,
  transcript: string,
) {
  const current = facts.suicidality;
  if (!current) return;
  if (current.assertion === "explicitly_denied") {
    // S’assurer qu’une evidence CURRENT PATIENT existe si la citation est trouvable.
    const hasPatientCurrent = current.evidences.some(
      (item) => item.speaker === "PATIENT" && item.temporality === "CURRENT" && item.source === "TRANSCRIPT",
    );
    if (hasPatientCurrent) return;
  }
  if (
    current.assertion !== "not_assessed" &&
    current.assertion !== "not_reported" &&
    current.assertion !== "uncertain" &&
    current.assertion !== "explicitly_denied"
  ) {
    return;
  }

  const quote = findFirstMatch(transcript, SUICIDALITY_CURRENT_DENIAL_RES);
  if (!quote) return;

  facts.suicidality = {
    ...current,
    assertion: "explicitly_denied",
    value: null,
    confidence: "high",
    temporality: "current_visit",
    source: "transcript",
    evidence: { quote },
    evidences: [
      {
        quote,
        speaker: "PATIENT",
        source: "TRANSCRIPT",
        temporality: "CURRENT",
      },
    ],
  };
}

type ClinicalSalvageSpec = {
  domain: FactDomain;
  patterns: RegExp[];
};

/**
 * Motifs génériques hébreu clinique — pas de liste patient.
 * Ne remplit un domaine que s’il est encore vide / uncertain.
 */
const CLINICAL_FACT_SALVAGE: ClinicalSalvageSpec[] = [
  {
    domain: "mood",
    patterns: [
      /היום\s+קמתי\s+ממש\s+עצוב[^.?!\n]{0,80}/,
      /עצוב[^.?!\n]{0,40}בכיתי[^.?!\n]{0,40}ריקנות/,
      /תחושה\s+של\s+ריקנות/,
      /בכיתי[^.?!\n]{0,60}ריקנות/,
    ],
  },
  {
    domain: "sleep",
    patterns: [
      /שנת[יי]\s+[^.?!\n]{0,50}שע(?:ה|ות)/,
      /ישנתי\s+[^.?!\n]{0,40}שע/,
      /שעה\s+ו?חצי[^.?!\n]{0,30}(?:שינה|ישנ)/,
    ],
  },
  {
    domain: "anxiety",
    patterns: [
      /העצים\s+לי\s+את\s+ה-?OCD/,
      /רומינצ[^.?!\n]{0,40}/,
      /פרשנות\s+יתר/,
    ],
  },
  {
    domain: "thoughtContent",
    patterns: [
      /העצים\s+לי\s+את\s+ה-?OCD/,
      /רומינצ/,
      /בדיק(?:ה|ות)\s+יתר/,
      /פרשנות\s+יתר/,
    ],
  },
  {
    domain: "insight",
    patterns: [
      /עכשיו\s+אני\s+איתך\s+מדבר\s+יותר\s+נכון/,
      /אני\s+מזהה\s+[^.?!\n]{0,40}/,
    ],
  },
  {
    domain: "isolation",
    patterns: [
      /אני\s+מפחד\s+להיות\s+לבד/,
      /פחד\s+מ(?:נטישה|דחייה|בדידות)/,
      /צורך\s+באישור/,
    ],
  },
  {
    domain: "behavior",
    patterns: [
      /בדיק(?:ה|ות)\s+(?:חוזר|יתר)/,
      /מבחנ(?:י|ות)\s+נאמנות/,
    ],
  },
];

function salvageDocumentedClinicalFacts(
  facts: Record<FactDomain, ClinicalFact>,
  transcript: string,
) {
  for (const spec of CLINICAL_FACT_SALVAGE) {
    const current = facts[spec.domain];
    if (!current) continue;
    if (
      current.assertion !== "not_assessed" &&
      current.assertion !== "not_reported" &&
      current.assertion !== "uncertain"
    ) {
      continue;
    }
    const quote = findFirstMatch(transcript, spec.patterns);
    if (!quote) continue;
    facts[spec.domain] = {
      ...current,
      assertion: "present",
      value: null,
      confidence: "medium",
      temporality: "current_visit",
      source: "transcript",
      evidence: { quote },
      evidences: [
        {
          quote,
          speaker: "PATIENT",
          source: "TRANSCRIPT",
          temporality: "CURRENT",
        },
      ],
    };
  }
}

/** Médicaments clairement identifiables vs déclaration de prise incertaine. */
const KNOWN_MED_RES: Array<{ patterns: RegExp[]; name: string }> = [
  { name: "בונדורמין", patterns: [/בונדורמין|Bondormin|בואנדורמין/i] },
];

const UNCERTAIN_MED_TAKE_RE =
  /אני\s+לוקח(?:ת)?\s+את\s+ה[\u0590-\u05FFA-Za-z\-]{2,24}/;

function salvageMedicationMentions(mentions: ClinicalFact[], transcript: string): ClinicalFact[] {
  const hasDocumented = mentions.some(
    (fact) => fact.assertion === "present" || fact.assertion === "uncertain",
  );
  if (hasDocumented) return mentions;

  for (const known of KNOWN_MED_RES) {
    const quote = findFirstMatch(transcript, known.patterns);
    if (!quote) continue;
    const takeCtx = findFirstMatch(transcript, [
      /אני\s+לוקח(?:ת)?\s+את\s+הבונדורמין/,
      /לוקח(?:ת)?\s+את\s+הבונדורמין/,
      /אני\s+לוקח(?:ת)?\s+את\s+Bondormin/i,
    ]);
    const evidenceQuote = takeCtx ?? quote;
    return [
      ...mentions,
      {
        ...emptyFact(),
        assertion: "present",
        value: known.name,
        confidence: "medium",
        temporality: "current_visit",
        source: "transcript",
        evidence: { quote: evidenceQuote },
        evidences: [
          {
            quote: evidenceQuote,
            speaker: "PATIENT",
            source: "TRANSCRIPT",
            temporality: "CURRENT",
          },
        ],
      },
    ];
  }

  const uncertainQuote = findFirstMatch(transcript, [UNCERTAIN_MED_TAKE_RE]);
  if (!uncertainQuote) return mentions;

  // Si la déclaration ressemble à un nom connu, déjà géré plus haut.
  return [
    ...mentions,
    {
      ...emptyFact(),
      assertion: "uncertain",
      value: null,
      confidence: "low",
      temporality: "current_visit",
      source: "transcript",
      evidence: { quote: uncertainQuote },
      evidences: [
        {
          quote: uncertainQuote,
          speaker: "PATIENT",
          source: "TRANSCRIPT",
          temporality: "CURRENT",
        },
      ],
    },
  ];
}

/** Motifs génériques de diminution longitudinale de suicidalité. */
const SUICIDALITY_IMPROVED_RES: RegExp[] = [
  /מחשבות\s+אובדניות[^.?]{0,40}הרבה\s+הרבה\s+פחות/,
  /מחשבות\s+אובדניות[^.?]{0,40}פחות/,
  /פחות\s+מחשבות\s+אובדניות/,
];

export function detectSuicidalityImprovement(transcript: string) {
  return SUICIDALITY_IMPROVED_RES.some((pattern) => pattern.test(transcript));
}

function findFirstMatch(transcript: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[0]?.trim()) return match[0].trim();
  }
  return null;
}

function quoteFound(item: EvidenceItem, transcript: string, nurseNotes: string) {
  const corpus = item.source === "NURSE_NOTE" ? nurseNotes : transcript;
  return quoteInTranscript(item.quote, corpus);
}

function stripLooseDose(fact: ClinicalFact, medication: boolean): ClinicalFact {
  if (fact.confidence === "high" && medication) return fact;
  if (!fact.value) return fact;
  if (!/\d/.test(fact.value)) return fact;
  if (!medication && fact.confidence === "high") return fact;
  const stripped = fact.value.replace(/\d+([.,]\d+)?/g, "").replace(/\s+/g, " ").trim();
  return { ...fact, value: stripped || null, confidence: "low" };
}

export function quoteInTranscript(quote: string, transcript: string) {
  const needle = normalize(quote);
  if (needle.length < 2) return false;
  return normalize(transcript).includes(needle);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
