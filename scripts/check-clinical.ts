import { composeReport } from "../src/lib/clinical/compose-report";
import { scrubForbidden } from "../src/lib/clinical/forbidden-phrases";
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

console.info("clinical checks ok");

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
    confidence,
  };
}
