import type { VisitType } from "@prisma/client";

import { isVisitType } from "@/lib/clinical/templates";
import { parseJerusalemInput } from "@/lib/visits/time";

export type VisitInput = {
  type: VisitType;
  occurredAt: Date;
  notes: string | null;
};

export function parseVisitForm(form: FormData): VisitInput | null {
  const type = form.get("type");
  const occurredAt = parseJerusalemInput(form.get("occurredAt"));
  if (typeof type !== "string" || !isVisitType(type) || !occurredAt) return null;

  const notes = clip(form.get("notes"), 4000);
  return { type, occurredAt, notes };
}

function clip(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}
