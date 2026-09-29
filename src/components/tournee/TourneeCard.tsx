"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  criticalMissingTypes,
  daysCountLabel,
  daysBetween,
  endOfCareBadge,
  firstPhoneDigits,
  formatPeriod,
  fmtSlotDate,
  getSlots,
  isDueToday,
  needsValidation,
  overallStatus,
  todayStr,
  toIntlPhone,
  WA_MESSAGE,
  wazeUrl,
} from "@/lib/tournee/logic";
import type { OverallState, TourneePatient } from "@/lib/tournee/types";

const STATE_DOT: Record<OverallState, string> = {
  validate: "bg-terra",
  overdue: "bg-danger",
  soon: "bg-warning",
  ok: "bg-success",
  idle: "bg-faint",
};

const STATE_LABEL: Record<OverallState, string> = {
  validate: "À valider",
  overdue: "En retard",
  soon: "Bientôt",
  ok: "À jour",
  idle: "À planifier",
};

export function TourneeCard({
  patient,
  open,
  onToggle,
  onValidatePeriod,
  onLogVisit,
  onToggleDoc,
  onEdit,
}: {
  patient: TourneePatient;
  open: boolean;
  onToggle: () => void;
  onValidatePeriod: () => void;
  onLogVisit: (type: "home" | "phone", entryIndex: number) => void;
  onToggleDoc: (entryIndex: number) => void;
  onEdit: () => void;
}) {
  const overall = overallStatus(patient);
  const phoneDigits = firstPhoneDigits(patient);
  const intl = toIntlPhone(phoneDigits);
  const waLink = intl ? `https://wa.me/${intl}?text=${encodeURIComponent(WA_MESSAGE)}` : null;
  const slots = getSlots(patient);
  const validate = needsValidation(patient);
  const missingTypes = criticalMissingTypes(patient);
  const eoc = endOfCareBadge(patient);
  const datedSlots = slots.filter((s) => s.date);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left active:bg-surface/60"
      >
        <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${STATE_DOT[overall.state]}`} />

        <div className="min-w-0 flex-1 space-y-2">
          {/* Nom + ville + alertes critiques */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {patient.address ? (
              <a
                href={wazeUrl(patient.address)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[15px] font-semibold text-accent underline decoration-accent/30 underline-offset-2"
              >
                {patient.name}
                <span className="ml-1 inline-block text-sm no-underline" aria-hidden="true">
                  🧭
                </span>
              </a>
            ) : (
              <span className="text-[15px] font-semibold text-ink">{patient.name}</span>
            )}
            <span className="text-sm text-muted">{patient.city}</span>
            {missingTypes.length > 0 ? (
              <>
                <span className="synapse-alert-pulse inline-flex items-center rounded-full bg-danger px-2.5 py-0.5 text-[11px] font-bold text-white">
                  ⚠️ {daysCountLabel(patient)}
                </span>
                {missingTypes.map((type) => (
                  <span
                    key={type}
                    title={type === "home" ? "Visite domicile manquante" : "Appel manquant"}
                    className="synapse-alert-pulse inline-flex h-6 w-6 items-center justify-center rounded-synapse-sm bg-danger text-white"
                  >
                    {type === "home" ? <HomeIcon /> : <PhoneIcon />}
                  </span>
                ))}
              </>
            ) : null}
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTone(overall.state)}`}>
              {STATE_LABEL[overall.state]}
            </span>
          </div>

          {/* Période / créneaux / EOC */}
          {validate ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onValidatePeriod();
                }}
                className="inline-flex w-full items-start rounded-full bg-terra-soft px-3 py-1.5 text-left text-xs font-semibold leading-snug text-terra"
              >
                📅 Période terminée ({formatPeriod(patient.cycleStart, patient.cycleEnd)}) — valider la suite
              </button>
              {eoc ? <EocBadge when={eoc.when} date={eoc.date} /> : null}
            </div>
          ) : !patient.homeQuota && !patient.phoneQuota ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-accent-strong">Aucune visite requise</span>
              {eoc ? <EocBadge when={eoc.when} date={eoc.date} /> : null}
            </div>
          ) : (
            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-accent-strong">
                  {formatPeriod(patient.cycleStart, patient.cycleEnd)}
                </span>
                {slots.map((slot, i) => {
                  const written = slot.entryIndex >= 0 && !!patient.history[slot.entryIndex]?.docWritten;
                  const hasEntry = slot.entryIndex >= 0;
                  return (
                    <span key={`${slot.type}-${i}`} className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onLogVisit(slot.type, slot.entryIndex)}
                        title={slot.type === "home" ? "Visite domicile" : "Appel"}
                        className={`inline-flex h-7 items-center gap-1 rounded-synapse-sm px-2 text-[11px] font-bold ${slotTone(slot.status)}`}
                      >
                        {slot.type === "home" ? <HomeIcon /> : <PhoneIcon />}
                        {slot.status !== "done" ? (
                          <span className="tabular-nums">{daysCountLabel(patient)}</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        disabled={!hasEntry}
                        onClick={() => {
                          if (hasEntry) onToggleDoc(slot.entryIndex);
                        }}
                        title={
                          hasEntry
                            ? written
                              ? "Transmission rédigée — appuyer pour changer"
                              : "Transmission pas encore rédigée — appuyer pour changer"
                            : "Visite pas encore effectuée"
                        }
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-synapse-sm ${
                          !hasEntry
                            ? "bg-danger-soft text-danger opacity-40"
                            : written
                              ? "bg-success-soft text-success"
                              : "bg-danger-soft text-danger"
                        }`}
                      >
                        <DocIcon written={written} />
                      </button>
                    </span>
                  );
                })}
              </div>
              {datedSlots.length > 0 ? (
                <p className="text-[11px] leading-relaxed text-muted">
                  {datedSlots.map((s, i) => (
                    <span key={`${s.type}-${s.date}-${i}`}>
                      {i > 0 ? " · " : null}
                      <span className="inline-flex items-center gap-0.5 align-middle">
                        {s.type === "home" ? <HomeIcon className="h-3 w-3" /> : <PhoneIcon className="h-3 w-3" />}
                      </span>{" "}
                      {s.status === "done" ? "" : "planifiée "}
                      {fmtSlotDate(s.date!)}
                      {s.time ? ` ${s.time}` : ""}
                    </span>
                  ))}
                </p>
              ) : null}
              {eoc ? <EocBadge when={eoc.when} date={eoc.date} /> : null}
            </div>
          )}

          {/* Contact */}
          {phoneDigits ? (
            <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <a
                href={`tel:${phoneDigits}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-terra-soft px-3 text-xs font-semibold text-terra"
              >
                📞 {phoneDigits}
              </a>
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-xs font-semibold text-white"
                >
                  💬 WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <span className={`mt-1 shrink-0 text-faint transition ${open ? "rotate-90" : ""}`} aria-hidden="true">
          ›
        </span>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-line/60 bg-surface/50 px-4 py-3 text-sm">
          {patient.address ? (
            <p className="leading-snug text-ink">
              <span className="text-muted">Adresse · </span>
              {patient.address}{" "}
              <a href={wazeUrl(patient.address)} target="_blank" rel="noreferrer" className="font-semibold text-accent">
                Waze
              </a>
            </p>
          ) : null}
          {patient.notes ? (
            <p className="leading-snug text-muted">
              <span className="font-medium text-ink">Notes · </span>
              {patient.notes}
            </p>
          ) : null}
          {patient.endOfCare && !eoc ? (
            <p className="text-xs text-muted">
              Fin de suivi prévue le {new Date(`${patient.endOfCare}T12:00:00`).toLocaleDateString("fr-FR")}
              {daysBetween(todayStr(), patient.endOfCare) < 0 ? " (passée)" : ""}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <ActionChip onClick={() => onLogVisit("home", -1)}>Visite domicile</ActionChip>
            <ActionChip onClick={() => onLogVisit("phone", -1)}>Appel</ActionChip>
            <ActionChip onClick={onValidatePeriod}>Période</ActionChip>
            <ActionChip onClick={onEdit}>Modifier</ActionChip>
          </div>
          <Link href="/nearby" className="block text-center text-xs font-semibold text-accent">
            Ouvrir la carte
          </Link>
          {patient.history.length > 0 ? (
            <ul className="space-y-1 border-t border-line/60 pt-2 text-xs text-muted">
              {patient.history
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 6)
                .map((h, i) => (
                  <li key={`${h.date}-${h.type}-${i}`}>
                    {h.date}
                    {h.time ? ` · ${h.time}` : ""} · {h.type === "home" ? "domicile" : "appel"} ·{" "}
                    {h.done ? "effectuée" : "planifiée"}
                    {h.docWritten ? " · transmission OK" : ""}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EocBadge({ when, date }: { when: string; date: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
      🚪 Fin de suivi {when} ({date})
    </span>
  );
}

function ActionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-synapse-sm bg-card px-3 text-xs font-semibold text-ink ring-1 ring-line/70 active:bg-accent-soft"
    >
      {children}
    </button>
  );
}

function badgeTone(state: OverallState) {
  if (state === "validate") return "bg-terra-soft text-terra";
  if (state === "overdue") return "bg-danger-soft text-danger";
  if (state === "soon") return "bg-warning-soft text-warning";
  if (state === "ok") return "bg-success-soft text-success";
  return "bg-surface text-muted";
}

function slotTone(status: "done" | "pending" | "urgent") {
  if (status === "done") return "bg-success-soft text-success";
  if (status === "urgent") return "bg-danger-soft text-danger";
  return "bg-warning-soft text-warning";
}

function HomeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-3.5V14h-5v6.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8.5 4.5h3l1 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 1v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.7 2 2 0 0 1 6.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon({ written }: { written: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {written ? (
        <path d="M9 13.5 11 15.5 15.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 10h6M9 13.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function useFilteredPatients(
  patients: TourneePatient[],
  query: string,
  city: string,
  stateFilter: OverallState | "all" | "today",
) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (city && p.city !== city) return false;
      if (stateFilter === "today") {
        if (!isDueToday(p)) return false;
      } else if (stateFilter !== "all") {
        if (overallStatus(p).state !== stateFilter) return false;
      }
      if (!q) return true;
      const hay = `${p.name} ${p.city} ${p.address} ${p.phones.join(" ")} ${p.notes}`.toLowerCase();
      return hay.includes(q);
    });
  }, [patients, query, city, stateFilter]);
}
