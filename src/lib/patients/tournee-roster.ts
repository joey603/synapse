/**
 * Types + helpers téléphone pour la sync liste tournée.
 */

export type RosterPatient = {
  key: string;
  firstName: string;
  lastName: string;
  city: string;
  address: string;
  accessInstructions: string | null;
  phones: string[];
  contactName: string | null;
  contactPhone: string | null;
  homeQuota: number;
  phoneQuota: number;
  note: string | null;
};

export function normalizePhoneDigits(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 11) return `0${digits.slice(3)}`;
  return digits;
}

export function extractPhoneCandidates(value: string | null | undefined) {
  if (!value) return [] as string[];
  return value
    .split(/[/|,;]| et /i)
    .map((part) => normalizePhoneDigits(part))
    .filter((d) => d.length >= 9);
}

export function formatRosterPhone(digits: string) {
  const n = normalizePhoneDigits(digits);
  if (!n) return "";
  if (n.startsWith("0")) return n;
  if (n.length === 9) return `0${n}`;
  return n;
}
