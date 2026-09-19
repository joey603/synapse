import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import { composeStructuredSections } from "../src/lib/clinical/structured-report";
import { validateExtraction } from "../src/lib/clinical/validators";
import { fixtureExtraction, DEFAULT_TRANSCRIPT } from "../fixtures/transcripts/demo";
import {
  JACKY_HAD_TRANSCRIPT,
  JACKY_SUICIDE_DENIAL_QUOTE,
  jackyExpectedRawExtraction,
} from "../fixtures/transcripts/jacky-had";
import { evaluateGoldTransmission } from "../fixtures/gold/001/case";

const prisma = new PrismaClient();
let failed = 0;

function ok(name: string) {
  console.info(`OK  ${name}`);
}
function fail(name: string, reason: string) {
  failed += 1;
  console.error(`FAIL ${name}: ${reason}`);
}

async function main() {
  // --- Test 1 rich visit ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    if (!validated) return fail("rich-visit", "validation failed");
    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    const goldPath = join(__dirname, "../fixtures/gold/001/last-output-he.txt");
    const reportHe = existsSync(goldPath) ? readFileSync(goldPath, "utf8") : "";
    if (reportHe.length < 2500) return fail("rich-visit", "finalReportHe gold too short");
    if (!sections.patientStatusNote?.trim()) return fail("rich-visit", "patientStatusNote empty");
    if (!sections.mainProblems?.trim()) return fail("rich-visit", "mainProblems empty");
    if (!sections.interventionsProvided?.trim()) return fail("rich-visit", "interventions empty");
    if (!sections.carePlan?.trim()) return fail("rich-visit", "carePlan empty");
    if (!sections.interventionsProvided.includes("CBT") && !sections.interventionsProvided.includes("TCC")) {
      return fail("rich-visit", "CBT missing");
    }
    ok("rich-visit");
  }

  // --- Test 2 silence ≠ denial ---
  {
    const validated = validateExtraction(fixtureExtraction("default"), DEFAULT_TRANSCRIPT);
    if (!validated) return fail("silence", "invalid");
    if (validated.facts.suicidality.assertion === "explicitly_denied") {
      return fail("silence", "denial invented");
    }
    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
    });
    if (/שולל|נשלל במפורש/.test(sections.mainProblems ?? "")) {
      return fail("silence", "denial projected");
    }
    ok("silence≠denial");
  }

  // --- Test 3 explicit current denial ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    if (validated?.facts.suicidality.assertion !== "explicitly_denied") {
      return fail("explicit-denial", "assertion lost");
    }
    const ev = validated.facts.suicidality.evidences[0];
    if (ev?.speaker !== "PATIENT" || ev.source !== "TRANSCRIPT" || ev.temporality !== "CURRENT") {
      return fail("explicit-denial", "attribution wrong");
    }
    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    if (!/המטופל שולל/.test(sections.mainProblems ?? "")) {
      return fail("explicit-denial", "denial missing from mainProblems prose");
    }
    if (sections.mainProblems?.includes(JACKY_SUICIDE_DENIAL_QUOTE)) {
      return fail("explicit-denial", "raw suicide quote leaked into Zebra prose");
    }
    if (/לא נבדק|לא תוארו מחשבות אובדניות/.test(sections.mainProblems ?? "")) {
      return fail("explicit-denial", "softened to not assessed");
    }
    ok("explicit-current-denial");
  }

  // --- Test 4 historical vs current ---
  {
    const validated = validateExtraction(
      {
        facts: {
          suicidality: {
            assertion: "present",
            value: "מחשבות אובדניות בעבר",
            evidences: [
              {
                quote: "בעבר היו לי מחשבות אובדניות",
                speaker: "PATIENT",
                source: "TRANSCRIPT",
                temporality: "HISTORICAL",
              },
            ],
          },
        },
      },
      "בעבר היו לי מחשבות אובדניות",
      "",
    );
    if (!validated) return fail("historical", "invalid");
    // After validation, historical present should not be current_visit denial/present as current
    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    if (sections.mainProblems?.includes("המטופל שולל")) {
      return fail("historical", "historical became current denial");
    }
    if (validated.facts.suicidality.temporality === "current_visit" && validated.facts.suicidality.assertion === "present") {
      // applyRules sets temporality current_visit only if CURRENT evidence exists
      return fail("historical", "historical marked current_visit present");
    }
    ok("historical-vs-current");
  }

  // --- Test 5 medication isolation ---
  {
    const validated = validateExtraction(
      {
        facts: {},
        medicationDiscrepancies: [
          {
            medication: "clozapine",
            recordDose: "250 mg",
            reportedDose: "250 mg",
            evidence: [
              {
                quote: "אני לוקח את הבונדורמין.",
                speaker: "PATIENT",
                source: "TRANSCRIPT",
                temporality: "CURRENT",
              },
            ],
          },
        ],
      },
      "אני לוקח את הבונדורמין. אני מרגיש עייף.",
      "",
    );
    if (!validated) return fail("isolation", "invalid");
    if (validated.medicationDiscrepancies.length > 0) return fail("isolation", "clozapine discrepancy kept");
    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
    });
    const blob = JSON.stringify(sections);
    if (/קלוז|clozapin|250/i.test(blob)) return fail("isolation", "clozapine in zebra");
    ok("medication-isolation");
  }

  // --- Test 6 driving ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const sections = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
    });
    if (sections.drivingRisk !== "NOT_ASSESSED") return fail("driving", String(sections.drivingRisk));
    ok("driving-NOT_ASSESSED");
  }

  // --- Test 7 diagnosis ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const emptyDx = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
    });
    if (emptyDx.diagnosisNote) return fail("diagnosis", "invented diagnosis");
    const withDx = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: "הפרעת חרדה", secondary: null },
      medications: [],
    });
    if (withDx.diagnosisNote !== "הפרעת חרדה") return fail("diagnosis", "patient record ignored");
    ok("diagnosis-from-record");
  }

  // --- Test 8 gender ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const male = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    const female = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "FEMALE",
    });
    if (!male.mainProblems?.includes("המטופל שולל")) return fail("gender", "male phrasing missing");
    if (male.mainProblems.includes("המטופלת")) return fail("gender", "female in male");
    if (!female.mainProblems?.includes("המטופלת שוללת")) return fail("gender", "female phrasing missing");
    ok("gender-grammar");
  }

  // --- Tests A–H : projection sémantique / prose ---
  {
    const { buildProjectedFacts, isEvidenceDump, projectionsTooSimilar, remapDomain, semanticFit } =
      await import("../src/lib/clinical/zebra-projection");

    // A — loneliness ≠ functioning
    if (remapDomain("functioning", "פחד מבדידות", "אני מפחד להיות לבד") !== "isolation") {
      return fail("A-semantic", "loneliness not remapped away from functioning");
    }
    if (semanticFit("functioning", "פחד מבדידות", "אני מפחד להיות לבד") > 0) {
      return fail("A-semantic", "loneliness still fits functioning");
    }

    // B — shared OCD evidence not cloned into 3 domains
    const ocdRaw = {
      facts: {
        anxiety: {
          assertion: "present",
          value: "רומינציה / OCD",
          confidence: "high",
          evidences: [
            { quote: "העצים לי את ה-OCD", speaker: "PATIENT", source: "TRANSCRIPT", temporality: "CURRENT" },
          ],
        },
        thoughtContent: {
          assertion: "present",
          value: "רומינציה / OCD",
          confidence: "high",
          evidences: [
            { quote: "העצים לי את ה-OCD", speaker: "PATIENT", source: "TRANSCRIPT", temporality: "CURRENT" },
          ],
        },
        behavior: {
          assertion: "present",
          value: "רומינציה / OCD",
          confidence: "high",
          evidences: [
            { quote: "העצים לי את ה-OCD", speaker: "PATIENT", source: "TRANSCRIPT", temporality: "CURRENT" },
          ],
        },
      },
    };
    const ocdValidated = validateExtraction(ocdRaw, "העצים לי את ה-OCD", "");
    if (!ocdValidated) return fail("B-reuse", "invalid");
    const projected = buildProjectedFacts(ocdValidated);
    const ocdDomains = projected
      .filter((item) => item.assertion === "present")
      .map((item) => item.domain);
    const overlapCount = ["anxiety", "thoughtContent", "behavior"].filter((d) =>
      ocdDomains.includes(d as "anxiety"),
    ).length;
    if (overlapCount >= 3) return fail("B-reuse", "same OCD evidence filled 3 domains");

    // C–H via Jacky compose
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const male = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    const female = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "FEMALE",
    });

    if (projectionsTooSimilar(male.patientStatusNote, male.mainProblems)) {
      return fail("C-diff", "status and problems too similar");
    }
    if (isEvidenceDump(male.patientStatusNote) || isEvidenceDump(male.mainProblems)) {
      return fail("D-prose", "evidence dump in Zebra fields");
    }
    if (!/שולל/.test(male.mainProblems ?? "") || !/ירידה משמעותית|שיפור|לעומת העבר/.test(male.mainProblems ?? "")) {
      return fail("E-suicide", "denial+improvement missing");
    }
    if (!male.mainProblems?.includes("המטופל") || male.mainProblems.includes("המטופלת")) {
      return fail("F-gender", "male regression");
    }
    if (!female.mainProblems?.includes("המטופלת שוללת")) return fail("F-gender", "female regression");
    if (male.drivingRisk !== "NOT_ASSESSED") return fail("G-driving", String(male.drivingRisk));
    if (!male.currentMedication?.includes("דיווח המטופל") && !male.currentMedication?.includes("טיפול תרופתי")) {
      return fail("H-med", "patient-reported medication missing");
    }
    if (/קלוז|clozapin/i.test(male.currentMedication ?? "")) return fail("H-med", "clozapine leak");

    // Loneliness must not appear under תפקוד label in prose
    if (/תפקוד/.test(male.patientStatusNote ?? "") && /מפחד להיות לבד/.test(male.patientStatusNote ?? "")) {
      return fail("A-semantic", "loneliness still under functioning in prose");
    }

    ok("projection-A-H");
  }

  // --- Tests null-value facts (cause bug Gold : value=null + quote CURRENT) ---
  {
    const {
      buildProjectedFacts,
      countDocumentedCurrentFacts,
      countProjectedPresent,
      isEvidenceDump,
      projectionsTooSimilar,
    } = await import("../src/lib/clinical/zebra-projection");

    function factNullValue(quote: string) {
      return {
        assertion: "present" as const,
        value: null,
        confidence: "high" as const,
        evidences: [
          { quote, speaker: "PATIENT" as const, source: "TRANSCRIPT" as const, temporality: "CURRENT" as const },
        ],
      };
    }

    const transcript = [
      "היום קמתי ממש עצוב, בכיתי, היה לי תחושה של ריקנות",
      "שנתי שעה וחצי",
      "העצים לי את ה-OCD",
      "אני מפחד להיות לבד",
      "עכשיו אני איתך מדבר יותר נכון",
      JACKY_SUICIDE_DENIAL_QUOTE,
      "מחשבות אובדניות הרבה הרבה פחות",
    ].join(". ");

    const raw = {
      facts: {
        mood: factNullValue("היום קמתי ממש עצוב, בכיתי, היה לי תחושה של ריקנות"),
        sleep: factNullValue("שנתי שעה וחצי"),
        anxiety: factNullValue("העצים לי את ה-OCD"),
        isolation: factNullValue("אני מפחד להיות לבד"),
        insight: factNullValue("עכשיו אני איתך מדבר יותר נכון"),
        suicidality: {
          assertion: "explicitly_denied",
          value: null,
          confidence: "high",
          evidences: [
            {
              quote: JACKY_SUICIDE_DENIAL_QUOTE,
              speaker: "PATIENT",
              source: "TRANSCRIPT",
              temporality: "CURRENT",
            },
          ],
        },
      },
      longitudinal: { suicidality: "improved" },
      finalReportHe: "IGNORE — ne doit pas être parsé pour Zebra. תוכן בדיוני שלא צריך להופיע בשדות.",
    };

    const validated = validateExtraction(raw, transcript, "");
    if (!validated) return fail("null-value-multi", "validation failed");

    // E — finalReportHe non utilisé
    if (validated.finalReportHe && /IGNORE/.test(validated.finalReportHe)) {
      // ok stored, but projection must ignore it
    }
    const projected = buildProjectedFacts(validated);
    const documentedN = countDocumentedCurrentFacts(validated);
    const projectedPresent = countProjectedPresent(projected);
    if (documentedN < 5) return fail("null-value-multi", `too few documented=${documentedN}`);
    if (projectedPresent < 3) {
      return fail("A-multi", `suicide monopolized projection present=${projectedPresent} projected=${JSON.stringify(projected)}`);
    }

    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });

    // A/C — plusieurs domaines dans status
    const status = sections.patientStatusNote ?? "";
    const problems = sections.mainProblems ?? "";
    if (!/עצב|בכי|ריקנות/.test(status)) return fail("A-multi", "mood missing from status");
    if (!/שינה|עייפ/.test(status)) return fail("A-multi", "sleep missing from status");
    if (!/OCD|רומינצ|בדיד|אישור|תובנה/.test(status)) {
      return fail("A-multi", "anxiety/relational/insight missing from status");
    }
    if (!/שולל/.test(status)) return fail("A-multi", "suicide missing from status");
    // C — suicide alone
    if (status.trim().split(/[.。]/).filter(Boolean).length < 2) {
      return fail("C-monopoly", "status collapsed to single clause");
    }

    // B — mainProblems aggregation
    if (!/הבעיות המרכזיות|מצוקה/.test(problems)) return fail("B-problems", "problem framing missing");
    if (!/שינה|OCD|רומינצ|בדיד|עצב/.test(problems)) return fail("B-problems", "problems too thin");
    if (!/ירידה משמעותית|לעומת העבר/.test(problems)) return fail("D-temporal", "longitudinal improvement missing");

    // D — historical not current: add historical-only mood should not appear as current distress alone
    // already covered by longitudinal suicide in problems vs current denial in status

    // E — no finalReport parsing
    if (/IGNORE|בדיוני/.test(status) || /IGNORE|בדיוני/.test(problems)) {
      return fail("E-no-parse", "finalReportHe leaked into projection");
    }

    // F — medication uncertainty (garbled)
    const medUncertain = composeStructuredSections({
      extraction: {
        ...validated,
        medicationMentions: [
          {
            assertion: "uncertain",
            value: null,
            confidence: "low",
            temporality: "current_visit",
            source: "transcript",
            evidence: { quote: "אני לוקח את המוןדרין" },
            evidences: [
              {
                quote: "אני לוקח את המוןדרין",
                speaker: "PATIENT",
                source: "TRANSCRIPT",
                temporality: "CURRENT",
              },
            ],
          },
        ],
      },
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    if (!medUncertain.currentMedication?.includes("לא זוהו בוודאות")) {
      return fail("F-med", "uncertain med not prudent");
    }
    if (/נמסר:\s*«/.test(medUncertain.currentMedication ?? "")) {
      return fail("F-med", "raw quote in medication field");
    }

    // G/H already covered elsewhere; I — no unsupported
    if (/פיצול|Cyclothymia|אבחנה/.test(status + problems)) {
      return fail("I-unsupported", "invented content");
    }
    if (isEvidenceDump(status) || isEvidenceDump(problems)) return fail("null-value-multi", "evidence dump");
    if (projectionsTooSimilar(status, problems)) return fail("null-value-multi", "status≈problems");

    console.info(
      `[test null-value] documentedCurrent=${documentedN} projectedPresent=${projectedPresent} projectedTotal=${projected.length}`,
    );
    ok("null-value-multi-facts-survive");
  }

  // --- Test 9 persistence ---
  {
    const jacky = await prisma.patient.findFirst({
      where: { firstName: "Jacky", city: "ראשון לציון" },
      select: { id: true, sex: true },
    });
    if (!jacky) return fail("persistence", "Jacky patient missing");
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const sections = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: jacky.sex,
    });
    const visit = await prisma.visit.create({
      data: {
        patientId: jacky.id,
        type: "IN_PERSON",
        occurredAt: new Date("2099-01-01T12:00:00.000Z"),
        pipelineStatus: "READY",
        report: {
          create: {
            status: "AI_GENERATED",
            templateKey: "in_person",
            aiDraft: "טיוטה זמנית לבדיקת persistence",
            editedDraft: "טיוטה זמנית לבדיקת persistence",
            ...sections,
          },
        },
      },
      include: { report: true },
    });
    const reloaded = await prisma.clinicalReport.findUnique({
      where: { visitId: visit.id },
      select: {
        patientStatusNote: true,
        drivingRisk: true,
        diagnosisNote: true,
        mainProblems: true,
        currentMedication: true,
        interventionsProvided: true,
        carePlan: true,
      },
    });
    await prisma.clinicalReport.delete({ where: { visitId: visit.id } }).catch(() => undefined);
    await prisma.visit.delete({ where: { id: visit.id } }).catch(() => undefined);

    if (!reloaded?.patientStatusNote?.trim()) return fail("persistence", "patientStatusNote lost");
    if (!reloaded.mainProblems?.trim()) return fail("persistence", "mainProblems lost");
    if (!reloaded.interventionsProvided?.trim()) return fail("persistence", "interventions lost");
    if (!reloaded.carePlan?.trim()) return fail("persistence", "carePlan lost");
    if (reloaded.drivingRisk !== "NOT_ASSESSED") return fail("persistence", "drivingRisk lost");
    ok("persistence-db-roundtrip");
  }

  // --- Test 10 validation lock (workflow) ---
  {
    // Le verrouillage UI est `validated === true` → champs locked; API refuse édition VALIDATED.
    // Vérifie que le code de route report refuse les champs si status VALIDATED (contrat).
    const route = readFileSync(
      join(__dirname, "../src/app/api/visits/[visitId]/report/route.ts"),
      "utf8",
    );
    if (!route.includes('status === "VALIDATED"') && !route.includes("VALIDATED")) {
      return fail("lock", "report route missing VALIDATED guard");
    }
    const ui = readFileSync(
      join(__dirname, "../src/components/visits/StructuredTransmission.tsx"),
      "utf8",
    );
    if (!ui.includes("locked={validated}")) return fail("lock", "UI lock missing");
    ok("validation-lock");
  }

  // --- Test: mainProblems n'injecte pas pointsToVerify / contradictions ---
  {
    const raw = {
      ...jackyExpectedRawExtraction(),
      pointsToVerify: [
        "יש לוודא מחדש מצב אובדנות היום, מאחר שלא נמסרה שלילה מפורשת של מחשבות אובדניות בתיעוד הנוכחי.",
        "יש לברר האם קיימת החמרה מתמשכת ב-OCD.",
      ],
      contradictions: [
        {
          kind: "other" as const,
          summary:
            "קיימת סתירה בין תחושת המטופל שהקשר היה משמעותי והצד השני מעוניין, לבין העובדה שהקשר הסתיים לאחר תגובה תוקפנית.",
          evidence: [
            {
              quote: "אני מפחד להיות לבד",
              speaker: "PATIENT" as const,
              source: "TRANSCRIPT" as const,
              temporality: "CURRENT" as const,
            },
            {
              quote: "העצים לי את ה-OCD",
              speaker: "PATIENT" as const,
              source: "TRANSCRIPT" as const,
              temporality: "CURRENT" as const,
            },
          ],
        },
      ],
    };
    const validated = validateExtraction(raw, JACKY_HAD_TRANSCRIPT, "");
    if (!validated) return fail("zebra-purity", "validation failed");
    if (validated.pointsToVerify.some((p) => /לא נמסרה שלילה מפורשת/.test(p))) {
      return fail("zebra-purity", "incompatible suicidality point survived");
    }
    if (validated.contradictions.some((c) => /תחושת המטופל|הקשר הסתיים/.test(c.summary))) {
      return fail("zebra-purity", "false relational contradiction survived");
    }
    const sections = composeStructuredSections({
      extraction: validated,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    if (/לאימות:|סתירות לתיעוד:/.test(sections.mainProblems ?? "")) {
      return fail("zebra-purity", "Analyse metadata leaked into mainProblems");
    }
    if (!sections.patientStatusNote?.trim()) return fail("zebra-purity", "patientStatusNote empty");
    if (!/שינה|עייפ|ריקנות|עצב|רומינצ|תובנה/.test(sections.patientStatusNote)) {
      return fail("zebra-purity", "patientStatusNote missing clinical content");
    }
    if (!/המטופל שולל/.test(sections.mainProblems ?? "")) {
      return fail("zebra-purity", "suicidality denial missing from mainProblems");
    }
    if (/נמסר:\s*«/.test(sections.patientStatusNote) || /נמסר:\s*«/.test(sections.mainProblems ?? "")) {
      return fail("zebra-purity", "evidence dump in Zebra fields");
    }
    ok("mainProblems-purity+status");
  }

  // --- Test: evidence denial invalide warning « pas de négation » ---
  {
    const raw = {
      facts: {
        suicidality: {
          assertion: "explicitly_denied",
          value: null,
          confidence: "high",
          evidences: [
            {
              quote: JACKY_SUICIDE_DENIAL_QUOTE,
              speaker: "PATIENT",
              source: "TRANSCRIPT",
              temporality: "CURRENT",
            },
          ],
        },
      },
      pointsToVerify: [
        "יש לוודא מחדש מצב אובדנות היום, מאחר שלא נמסרה שלילה מפורשת של מחשבות אובדניות בתיעוד הנוכחי.",
        "יש לעקוב אחר השינה.",
      ],
    };
    const validated = validateExtraction(raw, JACKY_HAD_TRANSCRIPT, "");
    if (!validated) return fail("suicidality-coherence", "invalid");
    if (validated.facts.suicidality.assertion !== "explicitly_denied") {
      return fail("suicidality-coherence", "denial lost");
    }
    if (validated.pointsToVerify.some((p) => /לא נמסרה שלילה/.test(p))) {
      return fail("suicidality-coherence", "incompatible point kept");
    }
    if (!validated.pointsToVerify.some((p) => /שינה/.test(p))) {
      return fail("suicidality-coherence", "unrelated point wrongly dropped");
    }
    ok("suicidality-point-coherence");
  }

  // --- Test: currentMedication patient-reported vs authoritative ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const reported = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    if (!reported.currentMedication?.includes("דיווח המטופל") && !reported.currentMedication?.includes("בונדורמין")) {
      // Salvage Bondormin → patient-reported prefix, or uncertain note
      if (!reported.currentMedication?.includes("טיפול תרופתי")) {
        return fail("med-sources", "patient-reported medication missing");
      }
    }
    const authoritative = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [{ name: "Lithium", dose: "600 mg", frequency: "1/d" }],
      sex: "MALE",
    });
    if (!authoritative.currentMedication?.includes("Lithium")) {
      return fail("med-sources", "authoritative med missing");
    }
    if (/קלוז|clozapin/i.test(authoritative.currentMedication ?? "")) {
      return fail("med-sources", "clozapine leak");
    }
    ok("medication-authoritative-vs-reported");
  }

  // --- Test: genre MALE/FEMALE sans formes barrées dans projection ---
  {
    const validated = validateExtraction(jackyExpectedRawExtraction(), JACKY_HAD_TRANSCRIPT, "");
    const male = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "MALE",
    });
    const female = composeStructuredSections({
      extraction: validated!,
      visitType: "IN_PERSON",
      diagnosis: { primary: null, secondary: null },
      medications: [],
      sex: "FEMALE",
    });
    const slash = /מטופל\/ת|מסר\/ה|תיאר\/ה|נוטל\/ת/;
    if (slash.test(JSON.stringify(male)) || slash.test(JSON.stringify(female))) {
      return fail("gender-no-slash", "slash forms in structured projection");
    }
    if (!male.mainProblems?.includes("המטופל שולל")) return fail("gender-no-slash", "male form missing");
    if (!female.mainProblems?.includes("המטופלת שוללת")) return fail("gender-no-slash", "female form missing");
    ok("gender-MALE-FEMALE-no-slash");
  }

  // --- Gold finalReportHe richness preserved ---
  {
    const goldPath = join(__dirname, "../fixtures/gold/001/last-output-he.txt");
    if (!existsSync(goldPath)) return fail("gold-report", "missing last-output");
    const text = readFileSync(goldPath, "utf8");
    const evaluation = evaluateGoldTransmission(text);
    if (!evaluation.ok) {
      return fail("gold-report", `missing=${evaluation.missing} invented=${evaluation.invented}`);
    }
    ok("gold-finalReportHe-richness");
  }

  if (failed > 0) {
    console.error(`\ncheck-zebra-phase2: ${failed} failed`);
    process.exitCode = 1;
    return;
  }
  console.info("\ncheck-zebra-phase2: ok");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
