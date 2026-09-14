import type { PipelineStatus, ReportStatus } from "@prisma/client";

export type WorkflowLabel =
  | "DRAFT"
  | "AUDIO_READY"
  | "TRANSCRIBED"
  | "ANALYZED"
  | "TRANSMISSION_GENERATED"
  | "VALIDATED";

export function workflowStatus(input: {
  recordingStored?: boolean;
  hasTranscript?: boolean;
  hasExtraction?: boolean;
  reportStatus?: ReportStatus | null;
  pipelineStatus?: PipelineStatus | null;
}): WorkflowLabel {
  if (input.reportStatus === "VALIDATED") return "VALIDATED";
  if (input.reportStatus === "AI_GENERATED" || input.reportStatus === "REVIEWED") {
    return "TRANSMISSION_GENERATED";
  }
  if (input.hasExtraction || input.pipelineStatus === "EXTRACTED") return "ANALYZED";
  if (input.hasTranscript || input.pipelineStatus === "TRANSCRIBED") return "TRANSCRIBED";
  if (input.recordingStored || input.pipelineStatus === "UPLOADED") return "AUDIO_READY";
  return "DRAFT";
}

export function visitHrefForStatus(patientId: string, visitId: string, status: WorkflowLabel) {
  if (status === "VALIDATED" || status === "TRANSMISSION_GENERATED") {
    return `/patients/${patientId}/visits/${visitId}?tab=report`;
  }
  if (status === "ANALYZED") return `/patients/${patientId}/visits/${visitId}?tab=analysis`;
  return `/patients/${patientId}/visits/${visitId}?tab=transcript`;
}
