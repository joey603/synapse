export const DEFAULT_TRANSCRIPT =
  "שלום. השבוע היה קשה. ישנתי שעתיים בלילה. Je mange un peu. לוקח את הכדור בערב, בערך.";

export const DENIAL_TRANSCRIPT =
  "אני לא חושב על מוות. ישנתי שעתיים בלילה.";

export function fixtureForFilename(filename: string | null) {
  if (filename?.toLowerCase().includes("denial")) {
    return {
      text: DENIAL_TRANSCRIPT,
      detectedLanguage: "he",
      kind: "denial" as const,
    };
  }
  if (filename?.toLowerCase().includes("fail")) {
    return { text: "", detectedLanguage: null, kind: "fail" as const };
  }
  return {
    text: DEFAULT_TRANSCRIPT,
    detectedLanguage: "mixed",
    kind: "default" as const,
  };
}

export function fixtureExtraction(kind: "default" | "denial") {
  if (kind === "denial") {
    return {
      facts: {
        sleep: present("ישנתי שעתיים בלילה"),
        suicidality: {
          value: null,
          assertion: "explicitly_denied",
          temporality: "current_visit",
          source: "transcript",
          evidence: { quote: "אני לא חושב על מוות" },
          confidence: "high",
        },
      },
      medicationMentions: [],
    };
  }

  return {
    facts: {
      sleep: present("ישנתי שעתיים בלילה"),
      appetite: present("Je mange un peu"),
      suicidality: {
        value: null,
        assertion: "explicitly_denied",
        temporality: "current_visit",
        source: "transcript",
        evidence: { quote: "אין מחשבות אובדניות" },
        confidence: "high",
      },
    },
    medicationMentions: [
      {
        value: "10 mg",
        assertion: "present",
        temporality: "current_visit",
        source: "transcript",
        evidence: { quote: "לוקח את הכדור בערב, בערך" },
        confidence: "low",
      },
    ],
  };
}

function present(quote: string) {
  return {
    value: null,
    assertion: "present",
    temporality: "current_visit",
    source: "transcript",
    evidence: { quote },
    confidence: "high",
  };
}
