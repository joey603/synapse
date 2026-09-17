import { emptyFact, type StoredExtraction } from "../src/lib/clinical/types";
import { composeStructuredSections, inferDrivingRisk } from "../src/lib/clinical/structured-report";
import { fixtureExtraction } from "../fixtures/transcripts/demo";
import { validateExtraction } from "../src/lib/clinical/validators";
import { DEFAULT_TRANSCRIPT } from "../fixtures/transcripts/demo";

function baseExtraction(): StoredExtraction {
  const untreated = validateExtraction(fixtureExtraction("default"), DEFAULT_TRANSCRIPT);
  if (!untreated) throw new Error("fixture invalid");
  return untreated;
}

{
  const extraction = baseExtraction();
  if (inferDrivingRisk(extraction) !== "NOT_ASSESSED") {
    throw new Error("silence must stay NOT_ASSESSED for driving");
  }
}

{
  const extraction = baseExtraction();
  extraction.facts.dangerousness = {
    ...emptyFact(),
    assertion: "explicitly_denied",
    temporality: "current_visit",
    source: "transcript",
    confidence: "high",
    evidence: { quote: "אני נוהג בזהירות" },
    evidences: [],
    value: "נהיגה תקינה",
  };
  if (inferDrivingRisk(extraction) !== "NO_RISK_IDENTIFIED") {
    throw new Error("explicit driving denial should map to NO_RISK_IDENTIFIED");
  }
}

{
  const extraction = baseExtraction();
  extraction.facts.dangerousness = {
    ...emptyFact(),
    assertion: "present",
    temporality: "current_visit",
    source: "transcript",
    confidence: "high",
    evidence: { quote: "קשה לי לנהוג" },
    evidences: [],
    value: "קושי בנהיגה",
  };
  if (inferDrivingRisk(extraction) !== "RISK_IDENTIFIED") {
    throw new Error("present driving risk should map to RISK_IDENTIFIED");
  }
}

{
  const extraction = baseExtraction();
  extraction.interventions = [{ text: "הקשבה פעילה", evidence: [] }];
  extraction.plan = [{ text: "המשך HAD", evidence: [] }];
  const sections = composeStructuredSections({
    extraction,
    visitType: "IN_PERSON",
    diagnosis: { primary: "סכיזופרניה", secondary: null },
    medications: [{ name: "Clozapine", dose: "250 mg", frequency: "1/jour" }],
  });
  if (sections.diagnosisNote !== "סכיזופרניה") throw new Error("diagnosis must come from chart");
  if (!sections.currentMedication?.includes("Clozapine")) throw new Error("meds from chart missing");
  if (!sections.interventionsProvided?.includes("הקשבה פעילה")) throw new Error("interventions missing");
  if (!sections.carePlan?.includes("המשך HAD")) throw new Error("plan missing");
  if (sections.drivingRisk !== "NOT_ASSESSED") throw new Error("no driving mention → NOT_ASSESSED");
}

console.info("check-structured-report: ok");
