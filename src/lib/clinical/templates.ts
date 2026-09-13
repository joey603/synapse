import type { VisitType } from "@prisma/client";

import type { MessageKey } from "@/lib/i18n/messages";

export const VISIT_TYPES = [
  "IN_PERSON",
  "VIRTUAL",
  "PHONE",
  "ADMISSION",
  "ASSESSMENT",
  "FAMILY_CONTACT",
  "OTHER",
] as const satisfies readonly VisitType[];

const LABELS: Record<VisitType, MessageKey> = {
  IN_PERSON: "visitInPerson",
  VIRTUAL: "visitVirtual",
  PHONE: "visitPhone",
  ADMISSION: "visitAdmission",
  ASSESSMENT: "visitAssessment",
  FAMILY_CONTACT: "visitFamily",
  OTHER: "visitOther",
};

export function visitTypeLabel(type: VisitType): MessageKey {
  return LABELS[type];
}

export function templateKeyFor(type: VisitType) {
  switch (type) {
    case "IN_PERSON":
      return "in_person";
    case "VIRTUAL":
    case "PHONE":
      return "remote";
    case "ADMISSION":
      return "admission";
    default:
      return "short";
  }
}

export function isVisitType(value: string): value is VisitType {
  return (VISIT_TYPES as readonly string[]).includes(value);
}
