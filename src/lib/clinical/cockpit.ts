import type { Assertion, ClinicalFact, FactDomain, StoredExtraction } from "@/lib/clinical/types";

const SIGNAL_DOMAINS = [
  "suicidality",
  "suicideIntent",
  "suicidePlan",
  "recentSuicidalBehavior",
  "selfHarm",
  "aggression",
  "dangerousness",
] as const satisfies readonly FactDomain[];

export type RiskReadout = "present" | "uncertain" | "denied" | "missing";

export function riskReadout(extraction: StoredExtraction | null): RiskReadout {
  if (!extraction) return "missing";
  const facts = SIGNAL_DOMAINS.map((domain) => extraction.facts[domain]).filter(Boolean);
  if (facts.some((fact) => fact.assertion === "present")) return "present";
  if (facts.some((fact) => fact.assertion === "uncertain")) return "uncertain";
  const suicide = extraction.facts.suicidality;
  if (suicide?.assertion === "explicitly_denied" && suicide.source === "transcript") return "denied";
  return "missing";
}

export function otherRiskUnassessed(extraction: StoredExtraction | null) {
  if (!extraction || riskReadout(extraction) !== "denied") return false;
  return SIGNAL_DOMAINS.some((domain) => {
    if (domain === "suicidality") return false;
    const assertion = extraction.facts[domain]?.assertion;
    return assertion === "not_assessed" || assertion === "not_reported" || !assertion;
  });
}

export function comparable(left: ClinicalFact | undefined, right: ClinicalFact | undefined) {
  return Boolean(left && right && assessed(left.assertion) && assessed(right.assertion));
}

function assessed(assertion: Assertion | undefined) {
  return assertion === "present" || assertion === "explicitly_denied" || assertion === "uncertain";
}

export type ActionPick =
  | { kind: "task"; href: string; title: string }
  | { kind: "visit"; href: string; code: "continue" | "transcribe" | "analyze" | "review" }
  | { kind: "scheduled"; href: string }
  | { kind: "new"; href: string };

export function pickNextAction(input: {
  patientId: string;
  today: string;
  tasks: Array<{ id: string; title: string; status: string; priority: string; dueDate: Date | null }>;
  unfinished: { id: string; status: "DRAFT" | "AUDIO_READY" | "TRANSCRIBED" | "ANALYZED" | "TRANSMISSION_GENERATED" } | null;
  nextVisitId: string | null;
}): ActionPick {
  const open = input.tasks.filter((task) => task.status !== "DONE");
  const urgent = open
    .filter((task) => task.priority === "URGENT" && task.dueDate && day(task.dueDate) <= input.today)
    .sort((a, b) => day(a.dueDate).localeCompare(day(b.dueDate)))[0];
  if (urgent) return { kind: "task", title: urgent.title, href: taskHref(input.patientId, urgent.id) };

  if (input.unfinished) {
    return {
      kind: "visit",
      href: visitHref(input.patientId, input.unfinished.id, input.unfinished.status),
      code: actionCode(input.unfinished.status),
    };
  }

  const important = open.find((task) => task.priority === "IMPORTANT");
  if (important) return { kind: "task", title: important.title, href: taskHref(input.patientId, important.id) };

  const horizon = addDays(input.today, 2);
  const due = open
    .filter((task) => task.priority === "NORMAL" && task.dueDate && day(task.dueDate) <= horizon)
    .sort((a, b) => day(a.dueDate).localeCompare(day(b.dueDate)))[0];
  if (due) return { kind: "task", title: due.title, href: taskHref(input.patientId, due.id) };

  if (input.nextVisitId) {
    return { kind: "scheduled", href: `/patients/${input.patientId}/visits/${input.nextVisitId}` };
  }
  return { kind: "new", href: `/patients/${input.patientId}/visits/new` };
}

export function jerusalemDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function visitHref(
  patientId: string,
  visitId: string,
  status: "DRAFT" | "AUDIO_READY" | "TRANSCRIBED" | "ANALYZED" | "TRANSMISSION_GENERATED",
) {
  if (status === "TRANSMISSION_GENERATED") return `/patients/${patientId}/visits/${visitId}?tab=report`;
  if (status === "ANALYZED") return `/patients/${patientId}/visits/${visitId}?tab=analysis`;
  return `/patients/${patientId}/visits/${visitId}?tab=transcript`;
}

function actionCode(status: "DRAFT" | "AUDIO_READY" | "TRANSCRIBED" | "ANALYZED" | "TRANSMISSION_GENERATED") {
  if (status === "TRANSMISSION_GENERATED") return "review" as const;
  if (status === "TRANSCRIBED") return "analyze" as const;
  if (status === "AUDIO_READY") return "transcribe" as const;
  if (status === "ANALYZED") return "continue" as const;
  return "continue" as const;
}

function taskHref(patientId: string, taskId: string) {
  return `/patients/${patientId}?tab=timeline&filter=tasks#task-${taskId}`;
}

function day(value: Date | null) {
  return value ? jerusalemDay(value) : "9999-12-31";
}

function addDays(dayValue: string, amount: number) {
  const date = new Date(`${dayValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
