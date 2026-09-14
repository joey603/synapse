import { composeReport } from "@/lib/clinical/compose-report";
import { scrubForbidden } from "@/lib/clinical/forbidden-phrases";
import { fixtureExtraction, fixtureForFilename } from "../../../fixtures/transcripts/demo";
import type { ClinicalLanguageProvider, TranscriptionProvider } from "@/lib/ai/types";

export const fakeTranscription: TranscriptionProvider = {
  async transcribe({ filename }) {
    const fixture = fixtureForFilename(filename);
    if (fixture.kind === "fail") {
      throw new Error("transcription_failed");
    }
    return {
      text: fixture.text,
      detectedLanguage: fixture.detectedLanguage,
      model: "fake-transcribe",
    };
  },
};

export const fakeClinical: ClinicalLanguageProvider = {
  async extract({ transcript }) {
    return fixtureExtraction(transcript.includes("אני לא חושב על מוות") ? "denial" : "default");
  },
  async writeReport(input) {
    return this.generateReport({
      extraction: input.extraction,
      visitType: "IN_PERSON",
      occurredAt: new Date(),
      patientName: "",
    });
  },
  async generateReport(input) {
    const composed = composeReport(input);
    return { text: scrubForbidden(composed, input.extraction).text, model: "fake-report" };
  },
  async rewrite({ text, action, extraction }) {
    const shortened = action === "shorten" ? shorten(text) : text;
    return { text: scrubForbidden(shortened, extraction).text, model: "fake-rewrite" };
  },
};

function shorten(text: string) {
  return text
    .split("\n\n")
    .map((block) => {
      const [title, ...rest] = block.split("\n");
      const body = rest.join(" ").split(/(?<=[.!?])\s/)[0] ?? rest.join(" ");
      return `${title}\n${body}`.trim();
    })
    .join("\n\n");
}
