"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { haversineMeters } from "@/lib/geo/distance";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

const PatientMap = dynamic(() => import("./PatientMap").then((mod) => mod.PatientMap), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse bg-accent-soft" />,
});

export type NearbyPatient = {
  id: string;
  firstName: string;
  lastName: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function NearbyView({
  locale,
  patients: initialPatients,
  needsResolve,
}: {
  locale: Locale;
  patients: NearbyPatient[];
  needsResolve: boolean;
}) {
  const [patients, setPatients] = useState(initialPatients);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [geo, setGeo] = useState<"idle" | "locating" | "ready" | "denied">("idle");
  const [placing, setPlacing] = useState(needsResolve);
  const [times, setTimes] = useState<Record<string, number>>({});
  const [timing, setTiming] = useState(false);
  const watchRef = useRef(0);
  const snapTimer = useRef(0);
  const lastRaw = useRef<{ lat: number; lng: number } | null>(null);
  const lastEta = useRef<{ lat: number; lng: number; key: string } | null>(null);

  const snapToStreet = useCallback(async (point: { lat: number; lng: number }) => {
    try {
      const response = await fetch("/api/nearby/snap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(point),
      });
      if (response.ok) {
        const body = (await response.json()) as { lat?: unknown; lng?: unknown; name?: unknown };
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setHere({ lat, lng });
          setStreet(typeof body.name === "string" && body.name ? body.name : null);
          setGeo("ready");
          return;
        }
      }
    } catch {
      // On garde le point GPS si la rue n’est pas trouvable.
    }
    setHere(point);
    setStreet(null);
    setGeo("ready");
  }, []);

  const queueSnap = useCallback(
    (point: { lat: number; lng: number }, source: "gps" | "tap") => {
      if (source === "gps" && lastRaw.current && haversineMeters(lastRaw.current, point) < 20) return;
      lastRaw.current = point;
      window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => {
        void snapToStreet(point);
      }, source === "tap" ? 0 : 250);
    },
    [snapToStreet],
  );

  const followGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGeo("denied");
      return;
    }
    setGeo("locating");
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = 0;
    }
    const accept = (position: GeolocationPosition) => {
      queueSnap({ lat: position.coords.latitude, lng: position.coords.longitude }, "gps");
    };
    const fail = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) setGeo("denied");
    };
    navigator.geolocation.getCurrentPosition(accept, fail, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
    watchRef.current = navigator.geolocation.watchPosition(accept, fail, {
      enableHighAccuracy: true,
      maximumAge: 0,
    });
  }, [queueSnap]);

  useEffect(() => {
    const id = window.setTimeout(followGps, 0);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(snapTimer.current);
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [followGps]);

  useEffect(() => {
    if (!needsResolve) return;
    let stop = false;
    let lastPending = Number.POSITIVE_INFINITY;

    async function resolvePlaces() {
      for (let round = 0; round < 30 && !stop; round += 1) {
        const response = await fetch("/api/nearby/resolve", { method: "POST" });
        if (!response.ok || stop) break;
        const body = (await response.json()) as {
          located?: Array<{ id: string; latitude: number; longitude: number }>;
          pending?: number;
        };
        const located = new Map((body.located ?? []).map((pin) => [pin.id, pin]));
        setPatients((current) =>
          current.map((patient) => {
            const pin = located.get(patient.id);
            return pin ? { ...patient, latitude: pin.latitude, longitude: pin.longitude } : patient;
          }),
        );
        const pending = body.pending ?? 0;
        if (pending === 0 || pending >= lastPending) break;
        lastPending = pending;
      }
      if (!stop) setPlacing(false);
    }

    void resolvePlaces();
    return () => {
      stop = true;
    };
  }, [needsResolve]);

  useEffect(() => {
    if (!here) return;
    const locatedKey = patients
      .filter((patient) => patient.latitude != null && patient.longitude != null)
      .map((patient) => patient.id)
      .join(",");
    if (!locatedKey) return;
    if (lastEta.current?.key === locatedKey && haversineMeters(lastEta.current, here) < 150) return;
    let stop = false;
    const id = window.setTimeout(() => {
      lastEta.current = { ...here, key: locatedKey };
      void (async () => {
        setTiming(true);
        try {
          const response = await fetch("/api/nearby/eta", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(here),
          });
          if (!response.ok || stop) return;
          const body = (await response.json()) as { times?: Array<{ id?: unknown; seconds?: unknown }> };
          const next: Record<string, number> = {};
          for (const item of body.times ?? []) {
            const seconds = Number(item.seconds);
            if (typeof item.id === "string" && Number.isFinite(seconds) && seconds > 0) next[item.id] = seconds;
          }
          if (!stop) setTimes(next);
        } catch {
          // L’itinéraire Waze reste disponible sans le temps.
        } finally {
          if (!stop) setTiming(false);
        }
      })();
    }, 400);
    return () => {
      stop = true;
      window.clearTimeout(id);
    };
  }, [here, patients]);

  const ordered = useMemo(() => {
    return [...patients].sort((a, b) => score(a, here, times) - score(b, here, times));
  }, [patients, here, times]);

  const pins = useMemo(
    () =>
      ordered.flatMap((patient, index) => {
        if (patient.latitude == null || patient.longitude == null) return [];
        return [{
          id: patient.id,
          lat: patient.latitude,
          lng: patient.longitude,
          label: `${patient.firstName} ${patient.lastName}`,
          rank: index + 1,
          href: wazeHref(patient, here),
          action: t(locale, "nearbyItinerary"),
        }];
      }),
    [ordered, locale, here],
  );

  if (patients.length === 0) {
    return <EmptyState title={t(locale, "nearbyEmpty")} body={t(locale, "nearbyEmptyHint")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div dir="ltr" className="overflow-hidden rounded-3xl ring-1 ring-line">
        <PatientMap
          here={here}
          pins={pins}
          meLabel={t(locale, "nearbyMe")}
          onPlace={(point) => queueSnap(point, "tap")}
        />
      </div>
      {geo === "locating" ? <p className="text-sm text-muted">{t(locale, "nearbyLocating")}</p> : null}
      {street ? (
        <p className="text-sm text-muted">
          {t(locale, "nearbyOnRoad")}
          {` · ${street}`}
        </p>
      ) : null}
      {placing ? <p className="text-sm text-muted">{t(locale, "nearbyGeoWait")}</p> : null}
      {geo === "denied" && !here ? <p className="text-sm text-muted">{t(locale, "nearbyDenied")}</p> : null}

      <SurfaceCard>
        {ordered.map((patient, index) => {
          const located = patient.latitude != null && patient.longitude != null;
          return (
            <div key={patient.id}>
              {index > 0 ? <div className="border-t border-line/70" /> : null}
              <a href={wazeHref(patient, here)} rel="noreferrer" className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 active:bg-surface/70">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-terra">
                  {located ? index + 1 : "–"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {patient.firstName} {patient.lastName}
                  </span>
                  <span className="block truncate text-sm text-muted">{placeLine(patient)}</span>
                  {located ? null : (
                    <span className="block truncate text-sm text-accent">
                      {t(locale, placing ? "nearbyGeoWait" : "nearbyUnlocated")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-end">
                  {times[patient.id] != null ? (
                    <span className="block text-sm font-semibold text-ink">{formatDrive(times[patient.id], locale)}</span>
                  ) : located && timing ? (
                    <span className="block text-sm text-faint">{t(locale, "nearbyTiming")}</span>
                  ) : null}
                  <span className="block text-sm font-semibold text-accent">{t(locale, "nearbyItinerary")}</span>
                </span>
              </a>
            </div>
          );
        })}
      </SurfaceCard>
    </div>
  );
}

function score(
  patient: NearbyPatient,
  here: { lat: number; lng: number } | null,
  times: Record<string, number>,
) {
  if (times[patient.id] != null) return times[patient.id];
  if (patient.latitude == null || patient.longitude == null) return Number.POSITIVE_INFINITY;
  if (!here) return Number.MAX_SAFE_INTEGER / 2;
  return haversineMeters(here, { lat: patient.latitude, lng: patient.longitude }) + 1_000_000;
}

function placeLine(patient: NearbyPatient) {
  return [patient.address, patient.city].filter(Boolean).join(", ");
}

function wazeHref(patient: NearbyPatient, here: { lat: number; lng: number } | null) {
  if (here && patient.latitude != null && patient.longitude != null) {
    return `https://www.waze.com/live-map/directions?from=ll.${here.lat},${here.lng}&to=ll.${patient.latitude},${patient.longitude}&navigate=yes`;
  }
  if (patient.latitude != null && patient.longitude != null) {
    const start = here ? `&from=${here.lat},${here.lng}` : "";
    return `https://waze.com/ul?ll=${patient.latitude},${patient.longitude}${start}&navigate=yes`;
  }
  const start = here ? `&from=${here.lat},${here.lng}` : "";
  return `https://waze.com/ul?q=${encodeURIComponent(placeLine(patient))}${start}&navigate=yes`;
}

function formatDrive(seconds: number, locale: Locale) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return locale === "he" ? `${minutes} דק׳` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (locale === "he") return rest ? `${hours} שע׳ ${rest}` : `${hours} שע׳`;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}
