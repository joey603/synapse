import type { PatientStatus, Sex } from "@prisma/client";

const SEXES = ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"] as const satisfies readonly Sex[];
const STATUSES = ["ACTIVE", "INACTIVE"] as const satisfies readonly PatientStatus[];

export type PatientInput = {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  sex: Sex;
  phone: string | null;
  city: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  insurer: string | null;
  referringPsychiatrist: string | null;
  referringNurse: string | null;
  admittedAt: Date | null;
  status: PatientStatus;
  primaryDiagnosis: string | null;
  secondaryDiagnoses: string | null;
  psychHistory: string | null;
  somaticHistory: string | null;
  suicideHistory: string | null;
  addictions: string | null;
  allergies: string | null;
  riskFactors: string | null;
  protectiveFactors: string | null;
  currentSummary: string | null;
};

export function parsePatientForm(form: FormData): PatientInput | null {
  const firstName = clip(form.get("firstName"), 80);
  const lastName = clip(form.get("lastName"), 80);
  if (!firstName || !lastName) return null;

  return {
    firstName,
    lastName,
    birthDate: parseDate(form.get("birthDate")),
    sex: oneOf(form.get("sex"), SEXES) ?? "UNSPECIFIED",
    phone: clip(form.get("phone"), 40),
    city: clip(form.get("city"), 80),
    address: clip(form.get("address"), 240),
    contactName: clip(form.get("contactName"), 120),
    contactPhone: clip(form.get("contactPhone"), 40),
    insurer: clip(form.get("insurer"), 80),
    referringPsychiatrist: clip(form.get("referringPsychiatrist"), 120),
    referringNurse: clip(form.get("referringNurse"), 120),
    admittedAt: parseDate(form.get("admittedAt")),
    status: oneOf(form.get("status"), STATUSES) ?? "ACTIVE",
    primaryDiagnosis: clip(form.get("primaryDiagnosis"), 240),
    secondaryDiagnoses: clip(form.get("secondaryDiagnoses"), 2000),
    psychHistory: clip(form.get("psychHistory"), 4000),
    somaticHistory: clip(form.get("somaticHistory"), 4000),
    suicideHistory: clip(form.get("suicideHistory"), 4000),
    addictions: clip(form.get("addictions"), 2000),
    allergies: clip(form.get("allergies"), 500),
    riskFactors: clip(form.get("riskFactors"), 2000),
    protectiveFactors: clip(form.get("protectiveFactors"), 2000),
    currentSummary: clip(form.get("currentSummary"), 8000),
  };
}

export function toInputDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function clip(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 2100) return null;
  return date;
}

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]) {
  if (typeof value !== "string") return null;
  return allowed.includes(value as T) ? (value as T) : null;
}
