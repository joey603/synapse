import type { OverallStatus, TourneePatient, VisitKind, VisitSlot } from "./types";

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Date calendaire locale YYYY-MM-DD (évite le décalage UTC Israël). */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(now = new Date()) {
  return toISODate(now);
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T12:00:00`).getTime();
  const b = new Date(`${toISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatPeriod(startISO: string, endISO: string) {
  const s = new Date(`${startISO}T00:00:00`);
  const e = new Date(`${endISO}T00:00:00`);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} → ${e.getDate()} ${MONTHS_FR[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_FR[s.getMonth()]} → ${e.getDate()} ${MONTHS_FR[e.getMonth()]}`;
}

export function formatTodayLabel(now = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

/**
 * Avec la semaine HAD calendaire, « à valider » = quoté défini mais semaine
 * déjà terminée côté affichage (cycleEnd < today) — rare si snapshot à jour.
 */
export function needsValidation(patient: TourneePatient, today = todayStr()) {
  if (patient.homeQuota <= 0 && patient.phoneQuota <= 0) return false;
  return patient.cycleEnd < today;
}

export function getSlots(patient: TourneePatient, today = todayStr()): VisitSlot[] {
  const daysLeft = daysBetween(today, patient.cycleEnd);
  const urgent = daysLeft <= 3;
  const slots: VisitSlot[] = [];

  (["home", "phone"] as VisitKind[]).forEach((type) => {
    const quota = type === "home" ? patient.homeQuota : patient.phoneQuota;
    if (!quota) return;

    const inWindow = patient.history
      .map((h, idx) => ({ h, idx }))
      .filter((o) => o.h.type === type && o.h.date >= patient.cycleStart && o.h.date <= patient.cycleEnd);

    const doneEntries = inWindow.filter((o) => o.h.done).sort((a, b) => (a.h.date < b.h.date ? -1 : 1));
    const plannedEntries = inWindow.filter((o) => !o.h.done).sort((a, b) => (a.h.date < b.h.date ? -1 : 1));

    let remaining = quota;
    doneEntries.slice(0, remaining).forEach((o) => {
      slots.push({ type, status: "done", entryIndex: o.idx, date: o.h.date, time: o.h.time });
      remaining -= 1;
    });
    plannedEntries.slice(0, Math.max(remaining, 0)).forEach((o) => {
      slots.push({
        type,
        status: urgent ? "urgent" : "pending",
        entryIndex: o.idx,
        date: o.h.date,
        time: o.h.time,
      });
      remaining -= 1;
    });
    while (remaining > 0) {
      slots.push({
        type,
        status: urgent ? "urgent" : "pending",
        entryIndex: -1,
        date: null,
        time: null,
      });
      remaining -= 1;
    }
  });

  return slots;
}

export function overallStatus(patient: TourneePatient, today = todayStr()): OverallStatus {
  if (needsValidation(patient, today)) return { state: "validate", days: null };
  const slots = getSlots(patient, today);
  if (!slots.length) return { state: "idle", days: null };
  const daysLeft = daysBetween(today, patient.cycleEnd);
  if (slots.some((s) => s.status === "urgent")) return { state: "overdue", days: daysLeft };
  if (slots.some((s) => s.status === "pending")) return { state: "soon", days: daysLeft };
  return { state: "ok", days: daysLeft };
}

export function isDueToday(patient: TourneePatient, today = todayStr()) {
  if (needsValidation(patient, today)) return true;
  const slots = getSlots(patient, today);
  if (slots.some((s) => s.status !== "done" && daysBetween(today, patient.cycleEnd) <= 0)) return true;
  if (patient.history.some((h) => !h.done && h.date === today)) return true;
  return false;
}

export function daysCountLabel(patient: TourneePatient, today = todayStr()) {
  const daysLeft = daysBetween(today, patient.cycleEnd);
  if (daysLeft > 0) return `J-${daysLeft}`;
  if (daysLeft === 0) return "J-0";
  return `J+${Math.abs(daysLeft)}`;
}

export function criticalMissingTypes(patient: TourneePatient, today = todayStr()): VisitKind[] {
  if (needsValidation(patient, today)) return [];
  const daysLeft = daysBetween(today, patient.cycleEnd);
  if (daysLeft > 2) return [];
  const slots = getSlots(patient, today);
  const missing: VisitKind[] = [];
  if (slots.some((s) => s.type === "home" && s.status !== "done")) missing.push("home");
  if (slots.some((s) => s.type === "phone" && s.status !== "done")) missing.push("phone");
  return missing;
}

export function endOfCareBadge(patient: TourneePatient, today = todayStr()) {
  if (!patient.endOfCare) return null;
  const d = daysBetween(today, patient.endOfCare);
  if (d < 0 || d > 10) return null;
  const when = d === 0 ? "aujourd’hui" : d === 1 ? "demain" : `dans ${d} j`;
  const date = new Date(`${patient.endOfCare}T12:00:00`).toLocaleDateString("fr-FR");
  return { when, date, days: d };
}

export function fmtSlotDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function firstPhoneDigits(patient: TourneePatient) {
  const raw = patient.phones[0] ?? "";
  // Certains imports collent 2 numéros dans un seul champ : "052… / 053…"
  const first = raw.split(/[/|,;]+/)[0]?.trim() ?? "";
  const digits = first.replace(/\D/g, "");
  return digits || null;
}

export function toIntlPhone(digits: string | null) {
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export const WA_MESSAGE =
  "Bonjour, ici l'infirmier de Tsabar Refoua. Je vous contacte concernant le suivi à domicile.";

export function wazeUrl(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function countByState(patients: TourneePatient[], today = todayStr()) {
  const counts = { validate: 0, overdue: 0, soon: 0, ok: 0, idle: 0 };
  for (const p of patients) {
    counts[overallStatus(p, today).state] += 1;
  }
  return counts;
}

export function workloadLine(patients: TourneePatient[], today = todayStr()) {
  let done = 0;
  let total = 0;
  for (const p of patients) {
    if (needsValidation(p, today)) continue;
    const slots = getSlots(p, today);
    total += slots.length;
    done += slots.filter((s) => s.status === "done").length;
  }
  const remaining = Math.max(0, total - done);
  return { done, total, remaining };
}
