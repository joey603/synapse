import { composeReport } from "../src/lib/clinical/compose-report";
import { hebrewNeedsRewrite, scrubForbidden } from "../src/lib/clinical/forbidden-phrases";
import { compareMedications } from "../src/lib/clinical/medication-compare";
import { reviewItems, visitDeltas } from "../src/lib/clinical/review-view";
import { quoteInTranscript, validateExtraction } from "../src/lib/clinical/validators";
import { emptyFact, type ClinicalFact, type Temporality } from "../src/lib/clinical/types";
import { fixtureExtraction, DEFAULT_TRANSCRIPT, DENIAL_TRANSCRIPT } from "../fixtures/transcripts/demo";

const untreated = validateExtraction(fixtureExtraction("default"), DEFAULT_TRANSCRIPT);
if (!untreated) throw new Error("default fixture invalid");
if (untreated.facts.suicidality.assertion === "explicitly_denied") {
  throw new Error("suicide not discussed produced a denial");
}
if (/\d/.test(untreated.medicationMentions[0]?.value ?? "")) {
  throw new Error("fuzzy dose kept a number");
}
const untreatedText = scrubForbidden(
  composeReport({
    extraction: untreated,
    visitType: "IN_PERSON",
    occurredAt: new Date("2026-09-13T06:45:00.000Z"),
    patientName: "Noa Levi",
  }),
  untreated,
).text;
if (/שולל מחשבות אובדני|אין מחשבות אובדני/.test(untreatedText)) {
  throw new Error("report contains a suicide denial");
}
if (!untreatedText.includes("לא הוערך במפגש זה")) {
  throw new Error("missing not-assessed formula");
}

const denied = validateExtraction(fixtureExtraction("denial"), DENIAL_TRANSCRIPT);
if (denied?.facts.suicidality.assertion !== "explicitly_denied") {
  throw new Error("explicit denial was not kept");
}
if (denied.facts.suicidality.evidence?.quote !== "אני לא חושב על מוות") {
  throw new Error("explicit denial lost its quote");
}
if (!composeReport({
  extraction: denied,
  visitType: "IN_PERSON",
  occurredAt: new Date("2026-09-13T06:45:00.000Z"),
  patientName: "Noa Levi",
}).includes("נשלל במפורש במפגש זה")) {
  throw new Error("explicit denial missing from report");
}

const presentText = "יש לי מחשבות על מוות כל ערב. ישנתי שעתיים.";
const present = validateExtraction(
  {
    facts: {
      suicidality: fact("present", "יש לי מחשבות על מוות כל ערב"),
      suicidePlan: fact("not_assessed", null),
    },
  },
  presentText,
);
if (present?.facts.suicidality.assertion !== "present") throw new Error("present suicide was lost");
if (present.facts.suicidePlan.assertion === "explicitly_denied") {
  throw new Error("missing plan was treated as a denial");
}
const presentReport = composeReport({
  extraction: present,
  visitType: "PHONE",
  occurredAt: new Date("2026-09-13T06:45:00.000Z"),
  patientName: "Noa Levi",
});
if (/נשלל במפורש/.test(presentReport.split("מחשבות אובדניות")[1]?.slice(0, 40) ?? "")) {
  throw new Error("present suicide written as a denial");
}
if (!presentReport.includes("לא הוערך במפגש זה")) throw new Error("unassessed plan missing");

const chart = [{ name: "Seroquel", dose: "100 mg" }, { name: "Viepax XR", dose: "225 mg" }];
const change = compareMedications(chart, [
  fact("present", "Seroquel 150 mg", "high"),
  fact("present", "Viepax XR 225 mg", "high"),
  fact("present", "Lorivan 1 mg", "high"),
  fact("uncertain", "quelque chose 50", "low"),
]);
if (!change.some((row) => row.tone === "change" && row.name === "Seroquel")) {
  throw new Error("dose change not detected");
}
if (!change.some((row) => row.tone === "absent")) throw new Error("chart-absent medication missed");
if (!change.some((row) => row.tone === "uncertain")) throw new Error("uncertain dose missed");
if (!change.some((row) => row.tone === "match")) throw new Error("matching medication missed");

const improved = validateExtraction(
  {
    facts: {
      mood: fact("present", "l’humeur est meilleure"),
      sleep: fact("present", "j’ai mieux dormi"),
      suicidality: emptyFact(),
    },
  },
  "l’humeur est meilleure. j’ai mieux dormi. I slept better.",
);
if (!improved) throw new Error("improvement fixture invalid");
improved.changes = visitDeltas(improved, {
  ...improved,
  facts: { ...improved.facts, mood: fact("present", "humeur dépressive"), suicidality: fact("explicitly_denied", "pas d’idées") },
  changes: [],
  reviewFlags: [],
  downgraded: [],
});
const flags = reviewItems(improved, chart, {
  ...improved,
  facts: { ...improved.facts, suicidality: fact("explicitly_denied", "pas d’idées") },
});
if (!flags.some((item) => item.code === "risk_missing" || item.code === "gap")) {
  throw new Error("missing suicide assessment was not flagged");
}
const improvedText = composeReport({
  extraction: improved,
  visitType: "IN_PERSON",
  occurredAt: new Date("2026-09-13T06:45:00.000Z"),
  patientName: "Noa Levi",
});
if (!improvedText.includes("מצב רוח")) throw new Error("improvement missing from report");
if (/אין מחשבות אובדני|absence d’idées/i.test(improvedText)) {
  throw new Error("improvement report invented a suicide absence");
}

const mixed = "ישנתי שעתיים בלילה. Je mange un peu. спал плохо.";
if (!quoteInTranscript("Je mange un peu", mixed)) throw new Error("french quote not found");
if (!quoteInTranscript("ישנתי שעתיים בלילה", mixed)) throw new Error("hebrew quote not found");
if (!quoteInTranscript("спал плохо", mixed)) throw new Error("russian quote not found");

const denialToday = "אני לא חושב על מוות";
const explicit = validateExtraction(
  { facts: { suicidality: evidenced("explicitly_denied", denialToday) } },
  denialToday,
);
if (explicit?.facts.suicidality.assertion !== "explicitly_denied") {
  throw new Error("case explicit denial was dropped");
}

const never = validateExtraction({ facts: { sleep: evidenced("present", "j’ai dormi") } }, "j’ai dormi");
if (never?.facts.suicidality.assertion !== "not_assessed") {
  throw new Error("case never discussed was not not_assessed");
}

const week = "שבוע שעבר חשבתי על מוות. היום אני לא חושב על מוות";
const recentPast = validateExtraction(
  {
    facts: {
      suicidality: {
        assertion: "explicitly_denied",
        evidences: [
          proof("שבוע שעבר חשבתי על מוות", { temporality: "RECENT_PAST" }),
          proof(denialToday),
        ],
      },
    },
  },
  week,
);
if (recentPast?.facts.suicidality.assertion !== "explicitly_denied") {
  throw new Error("case current denial was lost");
}
if (!recentPast.facts.suicidality.evidences.some((item) => item.temporality === "RECENT_PAST")) {
  throw new Error("case recent past evidence was folded away");
}

const sleepTalk = "je dors bien. il ne dort pas du tout";
const sleepClash = validateExtraction(
  {
    contradictions: [
      {
        kind: "patient_family",
        summary: "sommeil divergent",
        evidence: [proof("je dors bien", { speaker: "PATIENT" }), proof("il ne dort pas du tout", { speaker: "FAMILY" })],
      },
      { kind: "patient_family", summary: "sans preuve", evidence: [proof("phrase absente")] },
    ],
  },
  sleepTalk,
);
if (!sleepClash?.contradictions.some((item) => item.summary === "sommeil divergent")) {
  throw new Error("case cited sleep contradiction was dropped");
}
if (sleepClash.contradictions.some((item) => item.summary === "sans preuve")) {
  throw new Error("case uncited contradiction was kept");
}
if (!sleepClash.pointsToVerify.includes("sans preuve")) {
  throw new Error("case uncited contradiction was not sent to verify");
}

const backToWork = validateExtraction(
  {
    facts: { work: evidenced("present", "je retravaille depuis lundi") },
    longitudinal: { work: "improved" },
  },
  "je retravaille depuis lundi",
);
if (backToWork?.facts.work.assertion !== "present" || backToWork.longitudinal.work !== "improved") {
  throw new Error("case documented return to work lost its improvement");
}

const oldSleep = validateExtraction(
  { facts: { mood: evidenced("present", "l’humeur est plate") }, longitudinal: { sleep: "worsened" } },
  "l’humeur est plate",
);
if (oldSleep?.facts.sleep.assertion !== "not_assessed" || oldSleep.longitudinal.sleep !== "not_reassessed") {
  throw new Error("case undiscussed symptom was given a trajectory");
}

const lithiumTalk = "je prends Lithium 900 mg";
const lithium = validateExtraction(
  {
    medicationDiscrepancies: [
      { medication: "Lithium", recordDose: "600 mg", reportedDose: "900 mg" },
      { medication: "Inventedol", recordDose: "10 mg", reportedDose: "12 mg" },
    ],
  },
  lithiumTalk,
);
if (!lithium) throw new Error("case lithium fixture invalid");
const lithiumGap = lithium.medicationDiscrepancies.find((item) => item.medication === "Lithium");
if (!lithiumGap || !lithiumGap.requiresHumanReview || lithiumGap.recordDose !== "600 mg") {
  throw new Error("case lithium discrepancy was not kept for human review");
}
if (lithium.medicationDiscrepancies.some((item) => item.medication === "Inventedol")) {
  throw new Error("case uncited discrepancy was kept");
}

const taught = "j’ai expliqué le lithium";
const education = validateExtraction(
  {
    interventions: [
      { text: "éducation thérapeutique", evidence: [proof(taught, { speaker: "NURSE" })] },
      { text: "relaxation inventée", evidence: [proof("j’ai guidé une relaxation", { speaker: "NURSE" })] },
    ],
    suggestedTasks: ["demander une ordonnance de lithium"],
  },
  taught,
);
if (!education?.interventions.some((item) => item.text === "éducation thérapeutique")) {
  throw new Error("case documented intervention was dropped");
}
if (education.interventions.some((item) => item.text === "relaxation inventée")) {
  throw new Error("case invented intervention was kept");
}
if (!education.suggestedTasks.includes("demander une ordonnance de lithium")) {
  throw new Error("case suggested task was not kept as a suggestion");
}

const oldSuicide = validateExtraction(
  {
    facts: { suicidality: evidenced("present", "je veux mourir") },
    longitudinal: { suicidality: "worsened" },
  },
  "j’ai bien dormi",
);
if (oldSuicide?.facts.suicidality.assertion === "present" || oldSuicide?.facts.suicidality.assertion === "explicitly_denied") {
  throw new Error("case old suicide contaminated today");
}
if (oldSuicide?.longitudinal.suicidality === "worsened") {
  throw new Error("case old suicide invented a worsening");
}

const inventedHebrew = "המטופל שולל מחשבות אובדניות והלך לעבודה";
const hebrewSource = validateExtraction({ facts: { mood: evidenced("present", "יציב") }, finalReportHe: inventedHebrew }, "יציב");
if (!hebrewSource) throw new Error("case hebrew fixture invalid");
if (!hebrewNeedsRewrite(hebrewSource, inventedHebrew)) {
  throw new Error("case hebrew extra denial was accepted");
}
const corrected = scrubForbidden(inventedHebrew, hebrewSource);
if (!corrected.replaced || /שולל מחשבות אובדני/.test(corrected.text)) {
  throw new Error("case hebrew extra denial was not corrected");
}

const times = "la semaine dernière j’étais très triste. aujourd’hui je vais mieux";
const temporality = validateExtraction(
  {
    facts: {
      mood: {
        assertion: "present",
        evidences: [proof("la semaine dernière j’étais très triste", { temporality: "HISTORICAL" })],
      },
      sleep: {
        assertion: "present",
        evidences: [
          proof("aujourd’hui je vais mieux"),
          proof("la semaine dernière j’étais très triste", { temporality: "HISTORICAL" }),
        ],
      },
    },
  },
  times,
);
if (temporality?.facts.mood.assertion === "present") {
  throw new Error("case historical quote was treated as current status");
}
if (temporality?.facts.sleep.assertion !== "present") {
  throw new Error("case current quote was lost");
}
if (!temporality.facts.sleep.evidences.some((item) => item.temporality === "HISTORICAL")) {
  throw new Error("case historical evidence was discarded from a current fact");
}

const note = "le patient dit je ne pense pas à la mort";
const noted = validateExtraction(
  { facts: { suicidality: evidenced("explicitly_denied", "je ne pense pas à la mort", { source: "NURSE_NOTE" }) } },
  "rien sur ce sujet",
  note,
);
if (noted?.facts.suicidality.assertion !== "explicitly_denied") {
  throw new Error("case nurse note denial was rejected");
}
if (noted.facts.suicidality.evidences[0]?.speaker !== "PATIENT" || noted.facts.suicidality.evidences[0]?.source !== "NURSE_NOTE") {
  throw new Error("case nurse note lost speaker or source");
}
const spouseNote = validateExtraction(
  { facts: { suicidality: evidenced("explicitly_denied", "il ne pense pas à la mort", { speaker: "FAMILY", source: "NURSE_NOTE" }) } },
  "",
  "sa femme dit il ne pense pas à la mort",
);
if (spouseNote?.facts.suicidality.assertion === "explicitly_denied") {
  throw new Error("case family denial was accepted as the patient’s");
}

console.info("clinical checks ok");

function proof(
  quote: string,
  extra: Partial<{ speaker: "PATIENT" | "FAMILY" | "NURSE"; source: "TRANSCRIPT" | "NURSE_NOTE"; temporality: "CURRENT" | "RECENT_PAST" | "HISTORICAL" }> = {},
) {
  return {
    quote,
    speaker: extra.speaker ?? "PATIENT",
    source: extra.source ?? "TRANSCRIPT",
    temporality: extra.temporality ?? "CURRENT",
  };
}

function evidenced(
  assertion: ClinicalFact["assertion"],
  quote: string,
  extra: Parameters<typeof proof>[1] = {},
) {
  return {
    assertion,
    value: assertion === "present" ? quote : null,
    evidences: [proof(quote, extra)],
    confidence: "high" as const,
  };
}

function fact(
  assertion: ClinicalFact["assertion"],
  quote: string | null,
  confidence: ClinicalFact["confidence"] = "high",
): ClinicalFact {
  const temporality: Temporality = assertion === "not_assessed" ? "unknown" : "current_visit";
  return {
    value: quote,
    assertion,
    temporality,
    source: "transcript",
    evidence: quote ? { quote } : null,
    evidences: quote
      ? [{ quote, speaker: "PATIENT", source: "TRANSCRIPT", temporality: "CURRENT" }]
      : [],
    confidence,
  };
}
