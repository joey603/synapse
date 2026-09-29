"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TourneeCard, useFilteredPatients } from "@/components/tournee/TourneeCard";
import { TourneeSheet } from "@/components/tournee/TourneeSheet";
import {
  countByState,
  formatTodayLabel,
  formatPeriod,
  haversineKm,
  overallStatus,
  todayStr,
  workloadLine,
} from "@/lib/tournee/logic";
import { CITY_COORDS } from "@/lib/tournee/seed";
import type {
  OverallState,
  TourneePatient,
  TourneeSnapshot,
  VisitKind,
} from "@/lib/tournee/types";

type Sheet =
  | { kind: "none" }
  | { kind: "visit"; patientId: string; type: VisitKind; entryIndex: number }
  | { kind: "period"; patientId: string }
  | { kind: "patient"; patientId: string | null }
  | { kind: "nearby" }
  | { kind: "settings" };

export function TourneeApp({ initial }: { initial: TourneeSnapshot }) {
  const router = useRouter();
  const [patients, setPatients] = useState(initial.patients);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [stateFilter, setStateFilter] = useState<OverallState | "all" | "today">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [nearbyOrigin, setNearbyOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    setPatients(initial.patients);
  }, [initial]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const cities = useMemo(
    () => [...new Set(patients.map((p) => p.city).filter((c) => c && c !== "—"))].sort((a, b) => a.localeCompare(b, "fr")),
    [patients],
  );

  const filtered = useFilteredPatients(patients, query, city, stateFilter);
  const counts = useMemo(() => countByState(patients), [patients]);
  const workload = useMemo(() => workloadLine(patients), [patients]);
  const dateLabel = useMemo(() => formatTodayLabel(), []);

  const sorted = useMemo(() => {
    const rank: Record<OverallState, number> = {
      validate: 0,
      overdue: 1,
      soon: 2,
      idle: 3,
      ok: 4,
    };
    return [...filtered].sort((a, b) => {
      const da = rank[overallStatus(a).state];
      const db = rank[overallStatus(b).state];
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [filtered]);

  const patientById = useCallback((id: string) => patients.find((p) => p.id === id) ?? null, [patients]);

  const filterLabel =
    stateFilter === "all"
      ? null
      : stateFilter === "today"
        ? "Tournée du jour"
        : stateFilter === "validate"
          ? "À valider"
          : stateFilter === "overdue"
            ? "En retard"
            : stateFilter === "soon"
              ? "≤ 3 jours"
              : "À jour";

  async function api(url: string, init: RequestInit) {
    setBusy(true);
    setStatusMsg("");
    try {
      const response = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "save");
      }
      refresh();
      return true;
    } catch {
      setStatusMsg("Enregistrement impossible. Réessaie.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface">
      <div className="min-h-0 flex-1 overflow-y-auto pb-28 [-webkit-overflow-scrolling:touch]">
        <header className="space-y-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-muted">Tsabar Refoua · צבר רפואה</p>
              <h1 className="mt-0.5 text-[1.7rem] font-semibold leading-tight tracking-tight text-ink">Tournée</h1>
              <p className="mt-1 text-sm capitalize text-muted">{dateLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setSheet({ kind: "settings" })}
              className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-card"
              aria-label="Réglages"
            >
              <SettingsIcon />
            </button>
          </div>

          <p className="text-sm text-muted">
            Semaine {formatPeriod(initial.weekStart, initial.weekEnd)} · {workload.done}/{workload.total} effectuées ·{" "}
            {workload.remaining} restantes
          </p>

          <div className="grid grid-cols-4 gap-2">
            <StatButton value={counts.validate} label="à valider" tone="terra" active={stateFilter === "validate"} onClick={() => setStateFilter((s) => (s === "validate" ? "all" : "validate"))} />
            <StatButton value={counts.overdue} label="en retard" tone="danger" active={stateFilter === "overdue"} onClick={() => setStateFilter((s) => (s === "overdue" ? "all" : "overdue"))} />
            <StatButton value={counts.soon} label="≤ 3 j" tone="warning" active={stateFilter === "soon"} onClick={() => setStateFilter((s) => (s === "soon" ? "all" : "soon"))} />
            <StatButton value={counts.ok} label="à jour" tone="success" active={stateFilter === "ok"} onClick={() => setStateFilter((s) => (s === "ok" ? "all" : "ok"))} />
          </div>

          <button
            type="button"
            onClick={() => setStateFilter((s) => (s === "today" ? "all" : "today"))}
            className={`flex min-h-12 w-full items-center justify-center rounded-synapse-md text-[15px] font-semibold synapse-transition ${
              stateFilter === "today" ? "bg-accent text-white" : "bg-accent-soft text-accent-strong active:opacity-90"
            }`}
          >
            Ma tournée d&apos;aujourd&apos;hui
          </button>

          <div className="flex flex-col gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, ville, rue ou téléphone…"
              className="synapse-field min-h-11 w-full px-3 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <select value={city} onChange={(e) => setCity(e.target.value)} className="synapse-field min-h-11 px-2 text-sm" aria-label="Ville">
                <option value="">Villes</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNearbyOrigin(city || cities[0] || "");
                  setSheet({ kind: "nearby" });
                }}
                className="flex min-h-11 items-center justify-center rounded-synapse-sm bg-card text-sm font-semibold text-ink ring-1 ring-line/70 active:bg-surface"
              >
                Proches
              </button>
              <Link
                href="/nearby"
                className="flex min-h-11 items-center justify-center rounded-synapse-sm bg-card text-sm font-semibold text-ink ring-1 ring-line/70 active:bg-surface"
              >
                Carte
              </Link>
            </div>
          </div>
          {statusMsg ? <p className="text-center text-xs font-medium text-danger">{statusMsg}</p> : null}
          {busy ? <p className="text-center text-xs text-muted">Enregistrement…</p> : null}
        </header>

        <section className="px-4 pt-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-muted">
              {filterLabel ? `${filterLabel} · ` : ""}
              {sorted.length} {sorted.length === 1 ? "patient" : "patients"}
            </p>
            {stateFilter !== "all" || city || query ? (
              <button
                type="button"
                className="text-[13px] font-semibold text-accent"
                onClick={() => {
                  setStateFilter("all");
                  setCity("");
                  setQuery("");
                }}
              >
                Réinitialiser
              </button>
            ) : null}
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-synapse-md bg-card px-4 py-10 text-center ring-1 ring-line/70">
              <p className="text-sm font-medium text-ink">
                {patients.length === 0 ? "Aucun patient actif en base." : "Aucun patient ne correspond."}
              </p>
              {patients.length === 0 ? (
                <Link href="/patients/new" className="mt-3 inline-block text-sm font-semibold text-accent">
                  Créer un patient
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-synapse-md bg-card ring-1 ring-line/70">
              {sorted.map((p, index) => (
                <div key={p.id}>
                  {index > 0 ? <div className="border-t border-line/70" /> : null}
                  <TourneeCard
                    patient={p}
                    open={openId === p.id}
                    onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
                    onValidatePeriod={() => setSheet({ kind: "period", patientId: p.id })}
                    onLogVisit={(type, entryIndex) => setSheet({ kind: "visit", patientId: p.id, type, entryIndex })}
                    onToggleDoc={(entryIndex) => {
                      const entry = p.history[entryIndex];
                      if (!entry?.visitId) return;
                      void api("/api/tournee/visits", {
                        method: "PATCH",
                        body: JSON.stringify({ visitId: entry.visitId, docWritten: !entry.docWritten }),
                      });
                    }}
                    onEdit={() => setSheet({ kind: "patient", patientId: p.id })}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={() => setSheet({ kind: "patient", patientId: null })}
        className="absolute bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-terra text-2xl text-white shadow-nav active:scale-95"
        aria-label="Ajouter un patient"
      >
        ＋
      </button>

      <VisitSheet
        open={sheet.kind === "visit"}
        patient={sheet.kind === "visit" ? patientById(sheet.patientId) : null}
        type={sheet.kind === "visit" ? sheet.type : "home"}
        entryIndex={sheet.kind === "visit" ? sheet.entryIndex : -1}
        busy={busy}
        onClose={() => setSheet({ kind: "none" })}
        onSave={async (payload) => {
          if (sheet.kind !== "visit") return;
          const entry = sheet.entryIndex >= 0 ? patientById(sheet.patientId)?.history[sheet.entryIndex] : null;
          const ok = await api("/api/tournee/visits", {
            method: "POST",
            body: JSON.stringify({
              patientId: sheet.patientId,
              visitId: entry?.visitId ?? null,
              ...payload,
            }),
          });
          if (ok) setSheet({ kind: "none" });
        }}
        onDelete={async () => {
          if (sheet.kind !== "visit" || sheet.entryIndex < 0) return;
          const entry = patientById(sheet.patientId)?.history[sheet.entryIndex];
          if (!entry?.visitId) return;
          const ok = await api("/api/tournee/visits", {
            method: "DELETE",
            body: JSON.stringify({ visitId: entry.visitId }),
          });
          if (ok) setSheet({ kind: "none" });
        }}
      />

      <PeriodSheet
        open={sheet.kind === "period"}
        patient={sheet.kind === "period" ? patientById(sheet.patientId) : null}
        weekLabel={formatPeriod(initial.weekStart, initial.weekEnd)}
        busy={busy}
        onClose={() => setSheet({ kind: "none" })}
        onSave={async (patch) => {
          if (sheet.kind !== "period") return;
          const ok = await api("/api/tournee/patients", {
            method: "PATCH",
            body: JSON.stringify({ patientId: sheet.patientId, ...patch }),
          });
          if (ok) setSheet({ kind: "none" });
        }}
      />

      <PatientSheet
        open={sheet.kind === "patient"}
        patient={sheet.kind === "patient" && sheet.patientId ? patientById(sheet.patientId) : null}
        busy={busy}
        onClose={() => setSheet({ kind: "none" })}
        onSave={async (payload) => {
          if (sheet.kind !== "patient") return;
          const ok = await api("/api/tournee/patients", {
            method: sheet.patientId ? "PATCH" : "POST",
            body: JSON.stringify(sheet.patientId ? { patientId: sheet.patientId, ...payload } : payload),
          });
          if (ok) setSheet({ kind: "none" });
        }}
      />

      <TourneeSheet open={sheet.kind === "nearby"} title="Patients les plus proches" onClose={() => setSheet({ kind: "none" })}>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Choisis une ville d&apos;origine — tri à vol d&apos;oiseau. Pour l&apos;itinéraire exact, ouvre{" "}
          <Link href="/nearby" className="font-semibold text-accent">
            la carte Synapse
          </Link>
          .
        </p>
        <label className="mb-1 block text-xs font-medium text-muted">Où es-tu actuellement ?</label>
        <select
          value={nearbyOrigin}
          onChange={(e) => setNearbyOrigin(e.target.value)}
          className="synapse-field mb-4 min-h-11 w-full px-3 text-sm"
        >
          <option value="">Choisis une ville…</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <NearbyList patients={patients} originCity={nearbyOrigin} />
      </TourneeSheet>

      <TourneeSheet open={sheet.kind === "settings"} title="Réglages" onClose={() => setSheet({ kind: "none" })}>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Les patients et visites viennent de la base Synapse. Les quotas hebdomadaires (`weeklyInPersonVisits` /
          `weeklyVirtualVisits`) pilotent les créneaux. Une visite compte comme effectuée seulement si sa transmission
          est <b>VALIDATED</b>.
        </p>
        <Link href="/patients" className="flex min-h-11 items-center justify-center rounded-synapse-md bg-accent text-sm font-semibold text-white">
          Gérer les patients
        </Link>
      </TourneeSheet>
    </div>
  );
}

function StatButton({
  value,
  label,
  tone,
  active,
  onClick,
}: {
  value: number;
  label: string;
  tone: "terra" | "danger" | "warning" | "success";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    terra: "text-terra",
    danger: "text-danger",
    warning: "text-warning",
    success: "text-success",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-synapse-sm bg-card px-1.5 py-2.5 text-center ring-1 synapse-transition ${
        active ? "ring-accent bg-accent-soft" : "ring-line/70"
      }`}
    >
      <div className={`text-lg font-semibold tabular-nums leading-none ${toneClass}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-medium leading-tight text-muted">{label}</div>
    </button>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H8a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V8c.3.6.9 1.1 1.5 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NearbyList({ patients, originCity }: { patients: TourneePatient[]; originCity: string }) {
  const origin = CITY_COORDS[originCity] ?? cityCentroid(patients, originCity);
  if (!originCity || !origin) {
    return <p className="text-sm text-muted">Choisis une ville pour trier.</p>;
  }
  const ranked = patients
    .map((p) => {
      const point =
        p.latitude != null && p.longitude != null
          ? { lat: p.latitude, lng: p.longitude }
          : CITY_COORDS[p.city] ?? null;
      const km = point ? haversineKm(origin, point) : Number.POSITIVE_INFINITY;
      return { p, km };
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, 20);

  return (
    <ul className="space-y-2">
      {ranked.map(({ p, km }) => (
        <li key={p.id} className="flex items-center justify-between gap-3 rounded-synapse-sm bg-field px-3 py-2.5 ring-1 ring-line/55">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
            <p className="truncate text-xs text-muted">{p.city}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-accent">
              {Number.isFinite(km) ? `${km.toFixed(1)} km` : "—"}
            </p>
            {p.address ? (
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(p.address)}&navigate=yes`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-terra"
              >
                Waze
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function cityCentroid(patients: TourneePatient[], city: string) {
  const pts = patients.filter((p) => p.city === city && p.latitude != null && p.longitude != null);
  if (!pts.length) return null;
  const lat = pts.reduce((s, p) => s + (p.latitude ?? 0), 0) / pts.length;
  const lng = pts.reduce((s, p) => s + (p.longitude ?? 0), 0) / pts.length;
  return { lat, lng };
}

function VisitSheet({
  open,
  patient,
  type,
  entryIndex,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  patient: TourneePatient | null;
  type: VisitKind;
  entryIndex: number;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: {
    type: VisitKind;
    date: string;
    time: string | null;
    done: boolean;
    docWritten: boolean;
    note: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const existing = patient && entryIndex >= 0 ? patient.history[entryIndex] : null;
  const [visitType, setVisitType] = useState<VisitKind>(type);
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("");
  const [done, setDone] = useState(true);
  const [docWritten, setDocWritten] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setVisitType(existing?.type ?? type);
    setDate(existing?.date ?? todayStr());
    setTime(existing?.time ?? "");
    setDone(existing?.done ?? true);
    setDocWritten(existing?.docWritten ?? false);
    setNote(existing?.note ?? "");
  }, [open, existing, type]);

  return (
    <TourneeSheet
      open={open && Boolean(patient)}
      title={patient ? `Visite — ${patient.name}` : "Visite"}
      onClose={onClose}
      wideActions={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-synapse-md bg-field text-sm font-semibold text-ink">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSave({
                type: visitType,
                date,
                time: time || null,
                done,
                docWritten,
                note,
              })
            }
            className="min-h-11 flex-1 rounded-synapse-md bg-accent text-sm font-semibold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <Field label="Type">
        <Toggle
          options={[
            { id: "home", label: "Domicile" },
            { id: "phone", label: "Téléphone" },
          ]}
          value={visitType}
          onChange={(v) => setVisitType(v as VisitKind)}
        />
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="synapse-field min-h-11 w-full px-3 text-sm" />
        </Field>
        <Field label="Heure">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="synapse-field min-h-11 w-full px-3 text-sm" />
        </Field>
      </div>
      <Field label="Statut" className="mt-3">
        <Toggle
          options={[
            { id: "done", label: "Effectuée" },
            { id: "planned", label: "Planifiée" },
          ]}
          value={done ? "done" : "planned"}
          onChange={(v) => setDone(v === "done")}
        />
      </Field>
      <Field label="Transmission dans le dossier ?" className="mt-3">
        <Toggle
          options={[
            { id: "yes", label: "Rédigée → valide" },
            { id: "no", label: "Pas encore" },
          ]}
          value={docWritten ? "yes" : "no"}
          onChange={(v) => setDocWritten(v === "yes")}
        />
      </Field>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        « Rédigée » marque la visite <b>VALIDATED</b> en base (compte pour le quota HAD). Sinon elle reste en brouillon.
      </p>
      <Field label="Note" className="mt-3">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="synapse-field w-full px-3 py-2 text-sm" placeholder="Observations…" />
      </Field>
      {existing?.visitId ? (
        <button type="button" disabled={busy || existing.done} onClick={() => void onDelete()} className="mt-4 w-full text-sm font-semibold text-danger disabled:opacity-40">
          Supprimer cette visite
        </button>
      ) : null}
    </TourneeSheet>
  );
}

function PeriodSheet({
  open,
  patient,
  weekLabel,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  patient: TourneePatient | null;
  weekLabel: string;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: { homeQuota: number; phoneQuota: number }) => Promise<void>;
}) {
  const [homeQuota, setHomeQuota] = useState(1);
  const [phoneQuota, setPhoneQuota] = useState(1);

  useEffect(() => {
    if (!open || !patient) return;
    setHomeQuota(patient.homeQuota);
    setPhoneQuota(patient.phoneQuota);
  }, [open, patient]);

  return (
    <TourneeSheet
      open={open && Boolean(patient)}
      title="Quotas de la semaine"
      onClose={onClose}
      wideActions={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-synapse-md bg-field text-sm font-semibold">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave({ homeQuota, phoneQuota })}
            className="min-h-11 flex-1 rounded-synapse-md bg-accent text-sm font-semibold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">
        {patient ? (
          <>
            Quotas HAD pour <b>{patient.name}</b> — semaine {weekLabel}. La période suit le calendrier Jérusalem
            automatiquement.
          </>
        ) : null}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Domicile / semaine">
          <input
            type="number"
            min={0}
            value={homeQuota}
            onChange={(e) => setHomeQuota(Number(e.target.value) || 0)}
            className="synapse-field min-h-11 w-full px-3 text-sm"
          />
        </Field>
        <Field label="Appels / semaine">
          <input
            type="number"
            min={0}
            value={phoneQuota}
            onChange={(e) => setPhoneQuota(Number(e.target.value) || 0)}
            className="synapse-field min-h-11 w-full px-3 text-sm"
          />
        </Field>
      </div>
    </TourneeSheet>
  );
}

function PatientSheet({
  open,
  patient,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  patient: TourneePatient | null;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    city: string;
    address: string;
    phones: string;
    homeQuota: number;
    phoneQuota: number;
    endOfCare: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phones, setPhones] = useState("");
  const [homeQuota, setHomeQuota] = useState(1);
  const [phoneQuota, setPhoneQuota] = useState(1);
  const [endOfCare, setEndOfCare] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(patient?.name ?? "");
    setCity(patient?.city === "—" ? "" : patient?.city ?? "");
    setAddress(patient?.address ?? "");
    setPhones(patient?.phones.join(", ") ?? "");
    setHomeQuota(patient?.homeQuota ?? 1);
    setPhoneQuota(patient?.phoneQuota ?? 1);
    setEndOfCare(patient?.endOfCare ?? "");
    setNotes(patient?.notes ?? "");
  }, [open, patient]);

  return (
    <TourneeSheet
      open={open}
      title={patient ? "Modifier le patient" : "Nouveau patient"}
      onClose={onClose}
      wideActions={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-synapse-md bg-field text-sm font-semibold">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() =>
              void onSave({
                name: name.trim(),
                city: city.trim(),
                address: address.trim(),
                phones,
                homeQuota,
                phoneQuota,
                endOfCare,
                notes: notes.trim(),
              })
            }
            className="min-h-11 flex-1 rounded-synapse-md bg-accent text-sm font-semibold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <Field label="Nom">
        <input value={name} onChange={(e) => setName(e.target.value)} className="synapse-field min-h-11 w-full px-3 text-sm" />
      </Field>
      <Field label="Ville" className="mt-3">
        <input value={city} onChange={(e) => setCity(e.target.value)} className="synapse-field min-h-11 w-full px-3 text-sm" />
      </Field>
      <Field label="Adresse" className="mt-3">
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="synapse-field w-full px-3 py-2 text-sm" />
      </Field>
      <Field label="Téléphone(s) — séparés par une virgule" className="mt-3">
        <input value={phones} onChange={(e) => setPhones(e.target.value)} className="synapse-field min-h-11 w-full px-3 text-sm" />
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Domicile / semaine">
          <input type="number" min={0} value={homeQuota} onChange={(e) => setHomeQuota(Number(e.target.value) || 0)} className="synapse-field min-h-11 w-full px-3 text-sm" />
        </Field>
        <Field label="Appels / semaine">
          <input type="number" min={0} value={phoneQuota} onChange={(e) => setPhoneQuota(Number(e.target.value) || 0)} className="synapse-field min-h-11 w-full px-3 text-sm" />
        </Field>
      </div>
      <Field label="Fin de suivi" className="mt-3">
        <input type="date" value={endOfCare} onChange={(e) => setEndOfCare(e.target.value)} className="synapse-field min-h-11 w-full px-3 text-sm" />
      </Field>
      <Field label="Notes" className="mt-3">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="synapse-field w-full px-3 py-2 text-sm" />
      </Field>
    </TourneeSheet>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-synapse-sm bg-field p-1 ring-1 ring-line/55">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`min-h-10 rounded-[0.65rem] text-sm font-semibold ${value === opt.id ? "bg-accent text-white" : "text-muted"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
