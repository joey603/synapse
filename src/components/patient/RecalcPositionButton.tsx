"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { openWazeNavigation } from "@/lib/geo/open-waze";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

type Props = {
  locale: Locale;
  patientId: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function RecalcPositionButton({
  locale,
  patientId,
  address,
  city,
  latitude,
  longitude,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const line = placeLine(address, city);
  if (!line) return null;

  async function onRecalc() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/patients/${patientId}/regeocode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        latitude?: number;
        longitude?: number;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        setMessage(t(locale, "recalcPositionFail"));
        return;
      }
      setMessage(t(locale, "recalcPositionOk"));
      router.refresh();
      if (typeof body.latitude === "number" && typeof body.longitude === "number") {
        void openWazeNavigation({
          latitude: body.latitude,
          longitude: body.longitude,
          address,
          city,
        });
      }
    } catch {
      setMessage(t(locale, "recalcPositionFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-synapse-md bg-card px-4 py-3 ring-1 ring-line/70">
      <p className="text-xs font-medium text-muted">{t(locale, "fieldAddress")}</p>
      <p className="mt-0.5 text-[15px] text-ink">{line}</p>
      <p className="mt-1 text-sm text-muted">
        {latitude != null && longitude != null
          ? t(locale, "recalcPositionPlaced")
          : t(locale, "recalcPositionMissing")}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onRecalc()}
        className="mt-3 flex min-h-10 w-full items-center justify-center rounded-synapse-md bg-accent-soft px-4 text-sm font-semibold text-accent ring-1 ring-accent/20 disabled:opacity-60"
      >
        {busy ? t(locale, "recalcPositionPending") : t(locale, "recalcPosition")}
      </button>
      {message ? <p className="mt-2 text-center text-xs text-muted">{message}</p> : null}
    </div>
  );
}

function placeLine(address: string | null, city: string | null) {
  const street = (address ?? "").trim();
  const town = (city ?? "").trim();
  if (!street) return town || null;
  if (!town || street === town || street.endsWith(town)) return street;
  return `${street}, ${town}`;
}
