import { composeStructuredSections } from "../src/lib/clinical/structured-report";
import { validateExtraction } from "../src/lib/clinical/validators";
import {
  JACKY_HAD_TRANSCRIPT,
  JACKY_SUICIDE_DENIAL_QUOTE,
  jackyExpectedRawExtraction,
} from "../fixtures/transcripts/jacky-had";

const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
if (!validated) throw new Error("Jacky fixture failed validation");

if (validated.facts.suicidality.assertion !== "explicitly_denied") {
  throw new Error("Jacky suicidality current denial was lost");
}
if (!validated.facts.suicidality.evidences.some((item) => item.quote.includes(JACKY_SUICIDE_DENIAL_QUOTE))) {
  throw new Error("Jacky suicidality quote was not retained");
}
if (validated.facts.sleep.assertion !== "present") {
  throw new Error("Jacky sleep fact was lost");
}
if (validated.medicationDiscrepancies.some((item) => /clozapin/i.test(item.medication))) {
  throw new Error("Jacky unsupported Clozapine discrepancy was kept");
}
if (!validated.interventions.some((item) => /CBT|TCC|פסיכו/i.test(item.text))) {
  throw new Error("Jacky CBT/psychoeducation interventions were dropped");
}
if (!validated.plan.some((item) => /שינה|אובדנ|CBT|הערכה עצמית/i.test(item.text))) {
  throw new Error("Jacky care plan items were dropped");
}

const sections = composeStructuredSections({
  extraction: validated,
  visitType: "IN_PERSON",
  diagnosis: { primary: null, secondary: null },
  medications: [],
  sex: "MALE",
});

if (!sections.patientStatusNote?.trim()) throw new Error("patientStatusNote empty");
if (!sections.mainProblems?.trim()) throw new Error("mainProblems empty");
if (!sections.interventionsProvided?.trim()) throw new Error("interventionsProvided empty");
if (!sections.carePlan?.trim()) throw new Error("carePlan empty");
if (sections.drivingRisk !== "NOT_ASSESSED") throw new Error("drivingRisk must stay NOT_ASSESSED");
if (sections.diagnosisNote) throw new Error("diagnosis must stay empty without Patient diagnosis");
if (sections.currentMedication?.toLowerCase().includes("clozap")) {
  throw new Error("Clozapine leaked into currentMedication");
}
if (/clozapin|קלוז/i.test(sections.mainProblems ?? "")) {
  throw new Error("Clozapine leaked into mainProblems");
}
if (!sections.mainProblems.includes("שולל מחשבות אובדניות") && !sections.mainProblems.includes("שולל באופן מפורש")) {
  throw new Error("suicidality denial missing from mainProblems projection");
}
if (/נמסר:\s*«/.test(sections.patientStatusNote ?? "") || /נמסר:\s*«/.test(sections.mainProblems ?? "")) {
  throw new Error("Zebra prose must not dump raw evidence quotes");
}
if (sections.patientStatusNote === sections.mainProblems) {
  throw new Error("patientStatusNote and mainProblems must differ");
}
if (!sections.patientStatusNote.includes("שינה") && !sections.patientStatusNote.includes("עייפ")) {
  throw new Error("patientStatusNote missing sleep content");
}
if (!sections.patientStatusNote.includes("ריקנות") && !sections.patientStatusNote.includes("עצב")) {
  throw new Error("patientStatusNote missing mood content");
}
if (/תפקוד/.test(sections.patientStatusNote ?? "") && /מפחד להיות לבד/.test(sections.patientStatusNote ?? "")) {
  throw new Error("loneliness fear must not be projected as functioning");
}
if (!sections.interventionsProvided.includes("CBT") && !sections.interventionsProvided.includes("TCC")) {
  throw new Error("CBT interventions missing from interventionsProvided");
}
if (!/הבחנה בין עובדה לפרשנות|פרשנות/.test(sections.interventionsProvided)) {
  throw new Error("cognitive work missing from interventionsProvided");
}

console.info("check-jacky-pipeline: ok");
console.info(
  JSON.stringify(
    {
      patientStatusNote: sections.patientStatusNote,
      drivingRisk: sections.drivingRisk,
      diagnosisNote: sections.diagnosisNote,
      mainProblems: sections.mainProblems,
      currentMedication: sections.currentMedication,
      interventionsProvided: sections.interventionsProvided,
      carePlan: sections.carePlan,
    },
    null,
    2,
  ),
);
