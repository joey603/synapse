import { composeReport } from "../src/lib/clinical/compose-report";
import { scrubForbidden } from "../src/lib/clinical/forbidden-phrases";
import { validateExtraction } from "../src/lib/clinical/validators";
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

console.info("clinical checks ok");
