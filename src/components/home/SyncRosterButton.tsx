"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { parseTourneeList } from "@/lib/patients/parse-tournee-list";

type SyncResult = {
  ok: boolean;
  created?: string[];
  updated?: string[];
  discharged?: string[];
  totalRoster?: number;
  parseErrors?: string[];
  error?: string;
};

/** Bouton ＋ bas-droite + popup pour coller la liste hebdo. */
export function SyncRosterFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    return parseTourneeList(text);
  }, [text]);

  async function onSync() {
    if (busy || !text.trim()) return;
    const count = preview?.patients.length ?? 0;
    if (!count) {
      setMessage("Aucun patient détecté dans le texte collé.");
      return;
    }
    const confirmed = window.confirm(
      `Appliquer cette liste (${count} patients) ?\n\n• Crée / met à jour les patients détectés\n• Passe en « sorti » les patients actifs absents de la liste`,
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/patients/sync-roster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json().catch(() => null)) as SyncResult | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error ?? "save");
      }
      const created = body.created?.length ?? 0;
      const updated = body.updated?.length ?? 0;
      const discharged = body.discharged?.length ?? 0;
      setMessage(
        `OK · ${body.totalRoster ?? count} patients · ${created} créés · ${updated} mis à jour · ${discharged} sortis`,
      );
      setOpen(false);
      setText("");
      router.refresh();
    } catch {
      setMessage("Actualisation impossible. Vérifie le format de la liste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {message ? (
        <p className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-[4.75rem] z-20 rounded-synapse-sm bg-card/95 px-3 py-2 text-center text-xs text-muted shadow-nav ring-1 ring-line/70 backdrop-blur-sm">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-terra text-2xl leading-none text-white shadow-nav active:scale-95"
        aria-label="Actualiser les patients"
      >
        ＋
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-synapse-xl bg-card shadow-nav sm:max-h-[85dvh] sm:rounded-synapse-xl">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-5">
              <h2 className="text-lg font-semibold text-ink">Actualiser les patients</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-surface"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 pb-4 [-webkit-overflow-scrolling:touch] sm:px-5">
              <p className="text-sm leading-relaxed text-muted">
                Colle la liste WhatsApp de la semaine. L’app lit noms, quotas, villes, adresses et téléphones.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder={"01-Moche 2️⃣+1️⃣ 30-06 לוד\nרחוב …\n050…\n02-Rivka …"}
                className="synapse-field min-h-[12rem] w-full resize-y px-3 py-2 font-mono text-[13px] leading-relaxed"
              />
              {preview ? (
                <div className="rounded-synapse-sm bg-surface px-3 py-2 text-xs text-muted ring-1 ring-line/60">
                  <p className="font-semibold text-ink">
                    {preview.patients.length} patient{preview.patients.length === 1 ? "" : "s"} détecté
                    {preview.patients.length === 1 ? "" : "s"}
                  </p>
                  {preview.patients.length > 0 ? (
                    <p className="mt-1 line-clamp-3">
                      {preview.patients
                        .slice(0, 8)
                        .map((p) => `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""} (${p.homeQuota}+${p.phoneQuota})`)
                        .join(" · ")}
                      {preview.patients.length > 8 ? "…" : ""}
                    </p>
                  ) : null}
                  {preview.errors.length > 0 ? (
                    <p className="mt-1 text-warning">{preview.errors.slice(0, 3).join(" · ")}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-line/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="min-h-11 flex-1 rounded-synapse-md bg-field text-sm font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy || !(preview?.patients.length)}
                  onClick={() => void onSync()}
                  className="min-h-11 flex-1 rounded-synapse-md bg-accent text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Sync…" : "Appliquer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
