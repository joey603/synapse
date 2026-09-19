import type { Sex } from "@prisma/client";

import { hebrewClinicalText } from "@/lib/clinical/hebrew-text";
import type { ClinicalFact, FactDomain, StoredExtraction } from "@/lib/clinical/types";

/** Domaines candidats pour l’état actuel (מצב המטופל). */
const STATUS_BUCKETS = [
  "speech",
  "mood",
  "affect",
  "anxiety",
  "sleep",
  "appetite",
  "activity",
  "isolation",
  "thought",
  "thoughtContent",
  "insight",
  "agitation",
  "impulsivity",
] as const satisfies readonly FactDomain[];

/**
 * Fait projetable après nettoyage sémantique.
 * value = synthèse clinique (jamais une citation brute).
 */
export type ProjectedFact = {
  domain: FactDomain;
  value: string;
  assertion: ClinicalFact["assertion"];
  evolution?: string | null;
};

const FUNCTIONING_RE =
  /תפקוד|עבוד|תעסוק|ADL|עצמאות|יומיום|פעילות\s+יומית|חזר\s+לעבוד|fonctionnement|work\s*function/i;
const RELATIONAL_FEAR_RE =
  /מפחד\s+להיות\s+לבד|פחד\s+מ(?:נטישה|דחייה|בדידות)|צורך\s+באישור|קנאה|נטישה|דחייה|בדידות|לבד/i;
const OCD_RUMINATION_RE = /OCD|רומינצ|פרשנות\s+יתר|אובססי|חפיר|פלפול/i;
const BEHAVIOR_CHECK_RE = /בדיק(?:ה|ות)|מבחנ(?:י|ות)|חיפוש\s+סימנ/i;
const COOPERATION_RE = /משת[פף]\s+פעולה|שית[פף]\s+פעולה|קשר\s+טוב|פתוח|cooper/i;
const INSIGHT_RE = /תובנה|מתבונן|מזהה|מדבר\s+יותר\s+נכון|insight/i;
const SLEEP_RE = /שינה|ישנ|שנתי|עייפ|עייפות|שע(?:ה|ות)/i;
const MOOD_RE = /עצב|בכי|ריקנות|מצב\s+רוח|עצוב|מצוקה\s+רגשית|mood|sad/i;

/**
 * Score d’adéquation domaine ↔ contenu (value + quote).
 * Un score bas ⇒ le fait ne doit pas rester dans ce domaine pour Zebra.
 */
export function semanticFit(domain: FactDomain, value: string | null, quote: string | null): number {
  const blob = `${value ?? ""} ${quote ?? ""}`;
  if (!blob.trim()) return 0;

  switch (domain) {
    case "functioning":
    case "work":
    case "activity":
      if (RELATIONAL_FEAR_RE.test(blob) && !FUNCTIONING_RE.test(blob)) return 0;
      return FUNCTIONING_RE.test(blob) ? 3 : value && !RELATIONAL_FEAR_RE.test(blob) ? 1 : 0;

    case "isolation":
      return RELATIONAL_FEAR_RE.test(blob) ? 3 : 0;

    case "anxiety":
      if (RELATIONAL_FEAR_RE.test(blob)) return 2;
      if (OCD_RUMINATION_RE.test(blob)) return 3;
      return /חרד|anxiety|פחד/.test(blob) ? 2 : value ? 1 : 0;

    case "thoughtContent":
    case "thought":
      if (OCD_RUMINATION_RE.test(blob)) return 3;
      return value ? 1 : 0;

    case "behavior":
      // OCD quote seule sans valeur comportementale ⇒ faible.
      if (BEHAVIOR_CHECK_RE.test(blob)) return 3;
      if (OCD_RUMINATION_RE.test(blob) && !BEHAVIOR_CHECK_RE.test(value ?? "")) return 0;
      return value ? 1 : 0;

    case "mood":
    case "affect":
      return MOOD_RE.test(blob) ? 3 : value ? 1 : 0;

    case "sleep":
      return SLEEP_RE.test(blob) ? 3 : value ? 1 : 0;

    case "insight":
      return INSIGHT_RE.test(blob) ? 3 : value ? 1 : 0;

    case "speech":
      return COOPERATION_RE.test(blob) ? 3 : value ? 1 : 0;

    default:
      return value ? 1 : 0;
  }
}

/** Remappe un domaine mal classé vers un bucket plus juste. */
export function remapDomain(domain: FactDomain, value: string | null, quote: string | null): FactDomain {
  const blob = `${value ?? ""} ${quote ?? ""}`;
  if (
    (domain === "functioning" || domain === "work" || domain === "activity") &&
    RELATIONAL_FEAR_RE.test(blob) &&
    !FUNCTIONING_RE.test(blob)
  ) {
    return "isolation";
  }
  if (domain === "behavior" && OCD_RUMINATION_RE.test(blob) && !BEHAVIOR_CHECK_RE.test(value ?? "")) {
    return "thoughtContent";
  }
  return domain;
}

function primaryQuote(fact: ClinicalFact) {
  return (
    fact.evidence?.quote?.trim() ||
    fact.evidences.find((item) => item.temporality === "CURRENT")?.quote?.trim() ||
    fact.evidences[0]?.quote?.trim() ||
    null
  );
}

/**
 * Synthèse clinique pour Zebra.
 * Préfère fact.value ; si OpenAI laisse value=null (fréquent) mais qu’une quote CURRENT
 * valide existe, dériver une phrase clinique courte depuis le contenu de la quote.
 * Jamais « נמסר: «…» » — la citation reste en Analyse.
 */
function clinicalValue(fact: ClinicalFact, domain: FactDomain): string | null {
  const value = hebrewClinicalText(fact.value);
  if (value) return value;
  const quote = primaryQuote(fact);
  if (!quote) return null;
  return synthesizeFromQuote(domain, quote);
}

/**
 * Extrait des fragments cliniques réellement présents dans la citation / value.
 * Ne invente rien hors motifs supportés par le texte.
 */
export function extractClinicalMarkers(text: string): string[] {
  const bits: string[] = [];
  if (!text.trim()) return bits;
  if (/עצוב|עצב/.test(text)) bits.push("עצב");
  if (/בכיתי|בכי|בוכה|לבכות/.test(text)) bits.push("בכי");
  if (/ריקנות/.test(text)) bits.push("תחושת ריקנות");
  if (/חוסר\s+שקט|אי[־\s-]?שקט|נבהל|חרד/.test(text)) bits.push("חרדה");
  if (/OCD|רומינצ/.test(text)) bits.push("רומינציה / OCD");
  if (/פרשנות\s+יתר|בונה\s+בניינים|מפרש/.test(text)) bits.push("פרשנות יתר");
  if (/קנא(?:ה|ות)/.test(text)) bits.push("קנאה");
  if (/בדיק(?:ה|ות)|מבחנ(?:י|ות)|חפיר/.test(text)) bits.push("בדיקות חוזרות בקשר");
  if (/צורך.{0,12}אישור|ימשוך|רצוי|בודאות/.test(text)) bits.push("צורך באישור");
  if (/מפחד\s+להיות\s+לבד|פחד.{0,20}לבד|בדידות/.test(text)) bits.push("פחד מבדידות");
  if (/נטישה/.test(text)) bits.push("פחד מנטישה");
  if (/דחייה/.test(text)) bits.push("רגישות לדחייה");
  if (/שנתי|ישנתי|ישן|שעה\s+ו?חצי|שעתיים|שינה\s+מועטה|הפרעה\s+בשינה/.test(text)) {
    bits.push("הפרעת שינה");
  }
  if (/עייפ(?:ה|ות)|עייף/.test(text)) bits.push("עייפות");
  if (/מדבר\s+יותר\s+נכון|תובנה|מזהה\s+ש|אני\s+מבין/.test(text)) {
    bits.push("תובנה חלקית לדפוסים");
  }
  if (/משת[פף]\s+פעולה|שית[פף]\s+פעולה|פתוח/.test(text)) bits.push("שיתוף פעולה");
  return bits;
}

/** Facettes depuis une value clinique déjà synthétique (pas une citation brute). */
function facetsFromClinicalValue(value: string): string[] {
  const parts = splitFacets(value).filter((part) => part.length <= 50);
  const markers = extractClinicalMarkers(value);
  return [...parts, ...markers];
}

export function synthesizeFromQuote(domain: FactDomain, quote: string): string | null {
  const bits = extractClinicalMarkers(quote);

  if (bits.length > 0) {
    if (domain === "sleep") {
      const sleepBits = bits.filter((b) => /שינה|עייפ|הפרעת שינה/.test(b));
      if (sleepBits.length > 0) return uniqueJoin(sleepBits);
    }
    if (domain === "mood" || domain === "affect") {
      const moodBits = bits.filter((b) => /עצב|בכי|ריקנות|חרדה/.test(b));
      if (moodBits.length > 0) return uniqueJoin(moodBits);
    }
    if (domain === "insight") {
      const insightBits = bits.filter((b) => /תובנה/.test(b));
      if (insightBits.length > 0) return uniqueJoin(insightBits);
    }
    if (domain === "isolation") {
      const rel = bits.filter((b) => /בדידות|נטישה|דחייה|אישור|קנא/.test(b));
      if (rel.length > 0) return uniqueJoin(rel);
    }
    if (domain === "anxiety" || domain === "thoughtContent" || domain === "thought" || domain === "behavior") {
      const cog = bits.filter((b) => /OCD|רומינ|פרשנות|בדיק|חרדה|קנא|אישור/.test(b));
      if (cog.length > 0) return uniqueJoin(cog);
    }
    return uniqueJoin(bits);
  }

  if (semanticFit(domain, null, quote) >= 2) {
    if (domain === "sleep") return "הפרעת שינה";
    if (domain === "mood" || domain === "affect") return "מצוקה רגשית";
    if (domain === "anxiety") return "חרדה / רומינציה";
    if (domain === "thoughtContent" || domain === "thought") return "רומינציה";
    if (domain === "isolation") return "פחד מבדידות";
    if (domain === "insight") return "תובנה חלקית לדפוסים";
    if (domain === "behavior") return "בדיקות חוזרות בקשר";
    if (domain === "speech") return "שיתוף פעולה";
  }
  return null;
}

function isEncounterFact(fact: ClinicalFact) {
  if (fact.source === "patient_record" || fact.source === "previous_validated_visit") return false;
  return (
    fact.source === "transcript" ||
    fact.evidences.some((item) => item.source === "TRANSCRIPT" || item.source === "NURSE_NOTE")
  );
}

function normalizeQuote(quote: string) {
  return quote
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string) {
  const left = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
  const right = b
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (left.size === 0 || right.length === 0) return 0;
  let hit = 0;
  for (const token of right) if (left.has(token)) hit += 1;
  return hit / Math.max(left.size, right.length);
}

/**
 * Construit les faits projetables :
 * - remap sémantique ;
 * - exclusion si fit trop faible ;
 * - une même evidence ne remplit pas plusieurs domaines mécaniquement.
 */
export function buildProjectedFacts(extraction: StoredExtraction): ProjectedFact[] {
  type Candidate = ProjectedFact & { quoteKey: string | null; fit: number; rawValue: string };

  const candidates: Candidate[] = [];

  for (const domain of Object.keys(extraction.facts) as FactDomain[]) {
    const fact = extraction.facts[domain];
    if (!isEncounterFact(fact)) continue;
    if (fact.assertion !== "present" && fact.assertion !== "explicitly_denied") continue;
    if (fact.temporality === "historical" && fact.assertion === "present") {
      // Historique présent : utile surtout pour mainProblems risques, traité à part.
      continue;
    }
    if (fact.temporality !== "current_visit" && fact.assertion !== "explicitly_denied") continue;

    const quote = primaryQuote(fact);
    const value = clinicalValue(fact, domain);
    const mapped = remapDomain(domain, value, quote);
    const fit = semanticFit(mapped, value, quote);

    if (fact.assertion === "explicitly_denied") {
      candidates.push({
        domain: mapped === "functioning" ? domain : mapped,
        value: value ?? "",
        assertion: "explicitly_denied",
        evolution: extraction.longitudinal[domain] ?? null,
        quoteKey: quote ? normalizeQuote(quote) : null,
        fit: 3,
        rawValue: value ?? "",
      });
      continue;
    }

    // value peut être synthétisée depuis la quote CURRENT — ne plus dropper si value OpenAI est null.
    if (!value) continue;
    if (fit < 1) continue;

    candidates.push({
      domain: mapped,
      value,
      assertion: "present",
      evolution: extraction.longitudinal[domain] ?? extraction.longitudinal[mapped] ?? null,
      quoteKey: quote ? normalizeQuote(quote) : null,
      fit,
      rawValue: value,
    });
  }

  // Dédupliquer par quote partagée : garder le meilleur fit ; autoriser un second
  // domaine seulement si la value est nettement distincte et bien adaptée.
  const byQuote = new Map<string, Candidate[]>();
  const withoutQuote: Candidate[] = [];
  for (const item of candidates) {
    if (!item.quoteKey) {
      withoutQuote.push(item);
      continue;
    }
    const list = byQuote.get(item.quoteKey) ?? [];
    list.push(item);
    byQuote.set(item.quoteKey, list);
  }

  const kept: Candidate[] = [...withoutQuote];
  for (const group of byQuote.values()) {
    group.sort((a, b) => b.fit - a.fit);
    const primary = group[0];
    kept.push(primary);
    for (const other of group.slice(1)) {
      if (other.domain === primary.domain) continue;
      if (other.fit < 2) continue;
      // Autoriser une seconde facette si la value apporte des marqueurs distincts
      // (ex. בדיקות vs רומינציה) — ne pas compresser tous les domaines OCD en un seul.
      const primaryMarkers = extractClinicalMarkers(primary.rawValue).join(" ");
      const otherMarkers = extractClinicalMarkers(other.rawValue).join(" ");
      if (tokenOverlap(primary.rawValue, other.rawValue) > 0.75 && tokenOverlap(primaryMarkers, otherMarkers) > 0.75) {
        continue;
      }
      if (
        BEHAVIOR_CHECK_RE.test(other.rawValue) ||
        /פרשנות|בדיק|קנא|אישור/.test(other.rawValue) ||
        other.domain === "behavior" ||
        other.domain === "thoughtContent"
      ) {
        kept.push(other);
      }
    }
  }

  // Un domaine final unique (après remap).
  const byDomain = new Map<FactDomain, Candidate>();
  for (const item of kept) {
    const prev = byDomain.get(item.domain);
    if (!prev || item.fit > prev.fit) byDomain.set(item.domain, item);
  }

  return [...byDomain.values()].map(({ domain, value, assertion, evolution }) => ({
    domain,
    value,
    assertion,
    evolution,
  }));
}

function patientNoun(sex: Sex) {
  return sex === "FEMALE" ? "המטופלת" : "המטופל";
}

function describes(sex: Sex) {
  return sex === "FEMALE" ? "מתארת" : "מתאר";
}

function reports(sex: Sex) {
  return sex === "FEMALE" ? "מדווחת" : "מדווח";
}

function denies(sex: Sex) {
  return sex === "FEMALE" ? "שוללת" : "שולל";
}

function findProjected(facts: ProjectedFact[], domains: FactDomain[]) {
  return facts.filter((item) => domains.includes(item.domain) && item.assertion === "present");
}

function joinClinical(parts: string[]) {
  return parts
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * מצב המטופל — synthèse clinique naturelle de l’état actuel.
 * Pas de labels domaine, pas de « נמסר: «…» », pas de fragments « ניכרים X ».
 */
export function composePatientStatusProse(extraction: StoredExtraction, sex: Sex): string | null {
  const facts = buildProjectedFacts(extraction);
  const clauses: string[] = [];
  const noun = patientNoun(sex);

  const speech = findProjected(facts, ["speech"]);
  if (speech.some((item) => COOPERATION_RE.test(item.value) || /שיתוף פעולה/.test(item.value))) {
    clauses.push(
      sex === "FEMALE"
        ? `${noun} משתפת פעולה באופן מלא ומספרת באופן פתוח ומפורט.`
        : `${noun} משתף פעולה באופן מלא ומספר באופן פתוח ומפורט.`,
    );
  } else if (speech[0]) {
    clauses.push(`${describes(sex)} קשר תקין במהלך המפגש (${speech[0].value}).`);
  }

  const mood = findProjected(facts, ["mood", "affect"]);
  const anxiety = findProjected(facts, ["anxiety"]);
  const thought = findProjected(facts, ["thoughtContent", "thought"]);
  const emotional = uniqueJoin(
    [
      ...mood.flatMap((item) => splitFacets(item.value)),
      ...anxiety.flatMap((item) => splitFacets(item.value)),
      ...thought.flatMap((item) => splitFacets(item.value)).filter((f) => /OCD|רומינ|פרשנות|חרדה/.test(f)),
    ]
      .map((item) => normalizeFacet(item))
      .filter((item): item is string => Boolean(item)),
  );
  if (emotional) {
    clauses.push(`${describes(sex)} מצוקה רגשית משמעותית, עם ${emotional}.`);
  }

  const sleep = findProjected(facts, ["sleep"]);
  if (sleep[0]) {
    const sleepText = sleep[0].value
      .replace(/,?\s*בונדורמין|,?\s*Bondormin/gi, "")
      .replace(/,\s*,/g, ",")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^,|,$/g, "")
      .trim();
    if (sleepText) clauses.push(`${reports(sex)} על ${sleepText}.`);
  }

  const isolation = findProjected(facts, ["isolation"]);
  const behavior = findProjected(facts, ["behavior"]);
  const relational = uniqueJoin(
    [
      ...isolation.flatMap((item) => splitFacets(item.value)),
      ...behavior.flatMap((item) => splitFacets(item.value)),
      ...thought.flatMap((item) => splitFacets(item.value)).filter((f) => /בדיק|קנא|אישור|דחייה|נטישה/.test(f)),
    ]
      .map((item) => normalizeFacet(item))
      .filter((item): item is string => Boolean(item)),
  );
  // Éviter de répéter ce qui est déjà dans la phrase émotionnelle.
  const relationalFresh = relational
    ? uniqueJoin(
        splitFacets(relational).filter((f) => tokenOverlap(emotional, f) < 0.6),
      )
    : "";
  if (relationalFresh) {
    clauses.push(
      `${describes(sex)} גם רגישות בין־אישית ניכרת, כולל ${relationalFresh}.`,
    );
  }

  const insight = findProjected(facts, ["insight"]);
  if (insight[0]) {
    clauses.push(`ניכרת ${insight[0].value}.`);
  }

  const suicide = facts.find((item) => item.domain === "suicidality");
  if (suicide?.assertion === "explicitly_denied") {
    clauses.push(`${patientNoun(sex)} ${denies(sex)} באופן מפורש מחשבות אובדניות כיום.`);
  }

  const text = joinClinical(clauses);
  return text || null;
}

function normalizeFacet(item: string): string | null {
  const text = item.replace(/\s+/g, " ").trim();
  if (!text || text.length < 3 || text.length > 48) return null;
  if (/בונדורמין|Bondormin|העצים|בכיתי|קמתי|שנתי|לוקח/i.test(text)) return null;
  if (/רומינ|OCD|אובססי/.test(text)) return "רומינציה / OCD";
  if (/פרשנות/.test(text)) return "פרשנות יתר";
  if (/קנא/.test(text)) return "קנאה";
  if (/בדיק|מבחנ|חפיר|סימנים בקשר/.test(text)) return "בדיקות חוזרות בקשר";
  if (/אישור|בודאות/.test(text)) return "צורך באישור";
  if (/דחייה/.test(text) && /נטישה/.test(text)) return "פחד מדחייה / נטישה";
  if (/דחייה/.test(text)) return "רגישות לדחייה";
  if (/נטישה/.test(text)) return "פחד מנטישה";
  if (/בדידות|להיות לבד/.test(text)) return "פחד מבדידות";
  if (/ריקנות/.test(text)) return "תחושת ריקנות";
  if (/^עצב$|עצב,|, עצב/.test(text) || text === "עצב") return "עצב";
  if (/^בכי$|בכי/.test(text) && !/ריקנות/.test(text) && text.length <= 6) return "בכי";
  if (/הפרעת שינה|שינה מועטה/.test(text)) return "הפרעת שינה";
  if (/עייפ/.test(text)) return "עייפות";
  if (/תובנה/.test(text)) return null; // insight traité à part
  return text;
}

/**
 * Collecte les facettes discriminantes depuis values + quotes validées (sans inventer).
 */
function collectProblemFacets(extraction: StoredExtraction, projected: ProjectedFact[]): string[] {
  const bag: string[] = [];
  for (const item of projected) {
    if (item.assertion !== "present") continue;
    bag.push(...facetsFromClinicalValue(item.value));
  }
  for (const domain of Object.keys(extraction.facts) as FactDomain[]) {
    const fact = extraction.facts[domain];
    if (!isEncounterFact(fact)) continue;
    if (fact.assertion !== "present") continue;
    if (fact.temporality !== "current_visit") continue;
    if (fact.value) bag.push(...facetsFromClinicalValue(fact.value));
    const quote = primaryQuote(fact);
    if (quote) bag.push(...extractClinicalMarkers(quote));
  }
  // Interventions / plan validés (avec evidence) font partie du JSON clinique —
  // leurs thèmes discriminants peuvent enrichir בעיות מרכזיות sans inventer.
  for (const item of extraction.interventions) {
    if (!item.text || !item.evidence?.length) continue;
    bag.push(...extractClinicalMarkers(item.text));
  }
  for (const item of extraction.plan) {
    if (!item.text || !item.evidence?.length) continue;
    bag.push(...extractClinicalMarkers(item.text));
  }

  const priority = [
    "עצב",
    "בכי",
    "תחושת ריקנות",
    "רומינציה / OCD",
    "פרשנות יתר",
    "קנאה",
    "בדיקות חוזרות בקשר",
    "צורך באישור",
    "פחד מדחייה / נטישה",
    "רגישות לדחייה",
    "פחד מנטישה",
    "פחד מבדידות",
    "הפרעת שינה",
    "עייפות",
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of bag) {
    const item = normalizeFacet(raw);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    unique.push(item);
  }

  // Si forme combinée דחייה/נטישה présente, retirer les facettes redondantes.
  if (unique.includes("פחד מדחייה / נטישה")) {
    const drop = new Set(["רגישות לדחייה", "פחד מנטישה"]);
    for (let i = unique.length - 1; i >= 0; i -= 1) {
      if (drop.has(unique[i])) unique.splice(i, 1);
    }
  }

  unique.sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return unique;
}

function splitFacets(value: string): string[] {
  return value
    .split(/[,،]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 2);
}

/**
 * בעיות מרכזיות — problèmes cliniques discriminants de la visite.
 */
export function composeMainProblemsProse(extraction: StoredExtraction, sex: Sex): string | null {
  const facts = buildProjectedFacts(extraction);
  const clauses: string[] = [];

  const facets = collectProblemFacets(extraction, facts).filter(
    (f) => !/^תובנה/.test(f) && !/^שיתוף/.test(f),
  );
  const core = uniqueJoin(facets.filter((f) => !/הפרעת שינה|עייפות|שינה מועטה/.test(f)));
  const sleepFacets = uniqueJoin(facets.filter((f) => /הפרעת שינה|עייפות|שינה/.test(f)));

  if (core) {
    clauses.push(
      `הבעיות המרכזיות בביקור הנוכחי הן מצוקה רגשית ובין־אישית, כולל ${core}.`,
    );
  }

  const sleep = findProjected(facts, ["sleep"]);
  const sleepEvo = extraction.longitudinal.sleep;
  if (sleep[0] || sleepEvo === "worsened" || sleepFacets) {
    const sleepBody = sleepFacets || sleep[0]?.value || "הפרעת שינה";
    if (sleepEvo === "worsened") {
      clauses.push(
        `בנוסף מדווח על החמרה משמעותית בשינה ועייפות (${sleepBody}), עם השפעה אפשרית על הרומינציה וה-OCD.`,
      );
    } else {
      clauses.push(`בנוסף קיימת ${sleepBody}.`);
    }
  }

  const insight = findProjected(facts, ["insight"]);
  if (insight[0]) {
    clauses.push(`קיימת ${insight[0].value}.`);
  }

  const suicide = facts.find((item) => item.domain === "suicidality");
  const suicideEvo = extraction.longitudinal.suicidality;
  if (suicide?.assertion === "explicitly_denied") {
    if (suicideEvo === "improved") {
      clauses.push(
        `${patientNoun(sex)} ${denies(sex)} מחשבות אובדניות כיום ו${reports(sex)} על ירידה משמעותית בתדירותן לעומת העבר.`,
      );
    } else {
      clauses.push(`${patientNoun(sex)} ${denies(sex)} באופן מפורש מחשבות אובדניות כיום.`);
    }
  } else if (suicide?.assertion === "present" && suicide.value) {
    clauses.push(`עולה סיכון אובדני נוכחי: ${suicide.value}.`);
  }

  const functioning = findProjected(facts, ["functioning", "work", "activity"]);
  if (functioning[0]) {
    clauses.push(`במישור התפקודי: ${functioning[0].value}.`);
  }

  const text = joinClinical(clauses);
  return text || null;
}

function uniqueJoin(parts: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    // Skip near-duplicates.
    if ([...seen].some((prev) => tokenOverlap(prev, key) > 0.7)) continue;
    seen.add(key);
    out.push(part.trim());
  }
  return out.join(", ");
}

/** Heuristique : projections trop similaires (même skeleton). */
export function projectionsTooSimilar(status: string | null, problems: string | null) {
  if (!status?.trim() || !problems?.trim()) return false;
  if (status.trim() === problems.trim()) return true;
  const overlap = tokenOverlap(status, problems);
  // Doivent partager des thèmes mais pas être quasi-identiques.
  const statusStartsProblem = problems.trim().startsWith(status.trim().slice(0, 40));
  return overlap > 0.85 || statusStartsProblem;
}

export function isEvidenceDump(text: string | null) {
  if (!text) return false;
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return false;
  const dumped = lines.filter((line) => /נמסר:\s*«|:\s*נמסר:/.test(line)).length;
  return dumped / lines.length >= 0.5 || (/נמסר:\s*«/.test(text) && !/[.。]/.test(text.replace(/«[^»]*»/g, "")));
}

/** Compteurs diagnostic (tests / SYNAPSE_DEBUG_ZEBRA). */
export function countDocumentedCurrentFacts(extraction: StoredExtraction) {
  let n = 0;
  for (const domain of Object.keys(extraction.facts) as FactDomain[]) {
    const fact = extraction.facts[domain];
    if (!isEncounterFact(fact)) continue;
    if (fact.temporality !== "current_visit" && fact.assertion !== "explicitly_denied") continue;
    if (fact.assertion === "present" || fact.assertion === "explicitly_denied") n += 1;
  }
  return n;
}

export function countProjectedPresent(facts: ProjectedFact[]) {
  return facts.filter((item) => item.assertion === "present").length;
}

export { STATUS_BUCKETS };
