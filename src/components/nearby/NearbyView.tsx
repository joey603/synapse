"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { haversineMeters } from "@/lib/geo/distance";
import { openWazeNavigation } from "@/lib/geo/open-waze";
import { wazeNavigateHref } from "@/lib/geo/waze-link";
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
  const [geo, setGeo] = useState<"idle" | "ready" | "denied">("idle");
  const [placing, setPlacing] = useState(needsResolve);
  const [times, setTimes] = useState<Record<string, number>>({});
  const [timing, setTiming] = useState(false);
  const [etaNonce, setEtaNonce] = useState(0);
  const watchRef = useRef(0);
  const snapTimer = useRef(0);
  const lastRaw = useRef<{ lat: number; lng: number } | null>(null);
  const lastEta = useRef<{ lat: number; lng: number; key: string; nonce: number } | null>(null);
  const hasFix = useRef(false);
  const placeAbort = useRef<AbortController | null>(null);
  const snapToStreetRef = useRef<(point: { lat: number; lng: number }) => Promise<void>>(async () => undefined);

  const showFix = useCallback((point: { lat: number; lng: number }) => {
    hasFix.current = true;
    setHere(point);
    setGeo("ready");
    try {
      sessionStorage.setItem("synapse_here", JSON.stringify(point));
    } catch {
      // Cache local optionnel.
    }
  }, []);

  const snapToStreet = useCallback(async (point: { lat: number; lng: number }) => {
    showFix(point);
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
          showFix({ lat, lng });
          setStreet(typeof body.name === "string" && body.name ? body.name : null);
          return;
        }
      }
    } catch {
      // On garde le point GPS si la rue n’est pas trouvable.
    }
    showFix(point);
    setStreet(null);
  }, [showFix]);

  useEffect(() => {
    snapToStreetRef.current = snapToStreet;
  }, [snapToStreet]);

  useEffect(() => {
    let hadCachedFix = false;
    try {
      const cached = sessionStorage.getItem("synapse_here");
      if (cached) {
        const parsed = JSON.parse(cached) as { lat?: unknown; lng?: unknown };
        const lat = Number(parsed.lat);
        const lng = Number(parsed.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          lastRaw.current = { lat, lng };
          hadCachedFix = true;
          queueMicrotask(() => showFix({ lat, lng }));
        }
      }
    } catch {
      // Pas de cache.
    }

    if (!navigator.geolocation) {
      if (!hasFix.current && !hadCachedFix) setGeo("denied");
      return;
    }

    const accept = (position: GeolocationPosition) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      const moved = !lastRaw.current || haversineMeters(lastRaw.current, point) >= 20;
      lastRaw.current = point;
      showFix(point);
      if (!moved) return;
      window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => {
        void snapToStreetRef.current(point);
      }, 0);
    };
    const onDenied = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED && !hasFix.current) setGeo("denied");
    };

    navigator.geolocation.getCurrentPosition(accept, onDenied, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300_000,
    });
    watchRef.current = navigator.geolocation.watchPosition(accept, onDenied, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
    });

    return () => {
      window.clearTimeout(snapTimer.current);
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [showFix]);

  const resolvePlaces = useCallback(async (force: boolean) => {
    placeAbort.current?.abort();
    const controller = new AbortController();
    placeAbort.current = controller;

    if (force) {
      setPatients((current) =>
        current.map((patient) => ({ ...patient, latitude: null, longitude: null })),
      );
      setTimes({});
      lastEta.current = null;
    }

    setPlacing(true);
    let lastPending = Number.POSITIVE_INFINITY;
    let stalls = 0;

    try {
      for (let round = 0; round < 40; round += 1) {
        if (controller.signal.aborted) return;
        const response = await fetch("/api/nearby/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(round === 0 && force ? { force: true } : {}),
          signal: controller.signal,
        });
        if (!response.ok) break;
        const body = (await response.json()) as {
          located?: Array<{ id: string; latitude: number; longitude: number }>;
          pending?: number;
        };
        const located = new Map((body.located ?? []).map((pin) => [pin.id, pin]));
        setPatients((current) =>
          current.map((patient) => {
            const pin = located.get(patient.id);
            return pin
              ? { ...patient, latitude: pin.latitude, longitude: pin.longitude }
              : force && round === 0
                ? { ...patient, latitude: null, longitude: null }
                : patient;
          }),
        );
        const pending = body.pending ?? 0;
        if (pending === 0) break;
        if (pending >= lastPending) {
          stalls += 1;
          if (stalls >= 5) break;
        } else {
          stalls = 0;
          lastPending = pending;
        }
      }
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return;
    } finally {
      if (!controller.signal.aborted) {
        setPlacing(false);
        setEtaNonce((value) => value + 1);
      }
    }
  }, []);

  useEffect(() => {
    if (!needsResolve) return;
    void resolvePlaces(false);
    return () => {
      placeAbort.current?.abort();
    };
  }, [needsResolve, resolvePlaces]);

  // Estimation immédiate : l’UI n’attend pas OSRM pour afficher un temps.
  useEffect(() => {
    if (!here) return;
    setTimes((current) => {
      let changed = false;
      const next = { ...current };
      for (const patient of patients) {
        if (patient.latitude == null || patient.longitude == null) continue;
        if (next[patient.id] != null) continue;
        next[patient.id] = estimateDriveSeconds(
          haversineMeters(here, { lat: patient.latitude, lng: patient.longitude }),
        );
        changed = true;
      }
      return changed ? next : current;
    });
  }, [here, patients]);

  useEffect(() => {
    if (!here) return;
    const locatedIds = patients
      .filter((patient) => patient.latitude != null && patient.longitude != null)
      .map((patient) => patient.id);
    if (locatedIds.length === 0) return;
    const locatedKey = locatedIds.join(",");
    if (
      lastEta.current?.key === locatedKey &&
      lastEta.current.nonce === etaNonce &&
      haversineMeters(lastEta.current, here) < 250
    ) {
      return;
    }

    const origin = here;
    const refresh = etaNonce > 0 && lastEta.current?.nonce !== etaNonce;
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      lastEta.current = { ...origin, key: locatedKey, nonce: etaNonce };
      void (async () => {
        setTiming(true);
        try {
          const response = await fetch("/api/nearby/eta", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...origin, refresh }),
            signal: controller.signal,
          });
          if (!response.ok) return;
          const body = (await response.json()) as {
            times?: Array<{ id?: unknown; seconds?: unknown }>;
          };
          const batch: Record<string, number> = {};
          for (const item of body.times ?? []) {
            const seconds = Number(item.seconds);
            if (typeof item.id === "string" && Number.isFinite(seconds) && seconds > 0) {
              batch[item.id] = seconds;
            }
          }
          if (Object.keys(batch).length > 0) setTimes((current) => ({ ...current, ...batch }));
        } catch (error) {
          if ((error as { name?: string } | null)?.name === "AbortError") return;
        } finally {
          if (!controller.signal.aborted) setTiming(false);
        }
      })();
    }, 250);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [here, patients, etaNonce]);

  const onRecalc = useCallback(() => {
    if (placing) return;
    void (async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const point = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            lastRaw.current = point;
            void snapToStreetRef.current(point);
          },
          () => undefined,
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      }
      await resolvePlaces(true);
    })();
  }, [placing, resolvePlaces]);

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
          href: wazeNavigateHref(patient) ?? "#",
          action: t(locale, "nearbyItinerary"),
          address: patient.address,
          city: patient.city,
        }];
      }),
    [ordered, locale],
  );

  if (patients.length === 0) {
    return <EmptyState title={t(locale, "nearbyEmpty")} body={t(locale, "nearbyEmptyHint")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div dir="ltr" className="overflow-hidden rounded-synapse-lg ring-1 ring-line">
        <PatientMap
          here={here}
          pins={pins}
          meLabel={t(locale, "nearbyMe")}
        />
      </div>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-auto shrink-0 px-4"
          disabled={placing}
          onClick={onRecalc}
        >
          {placing ? t(locale, "nearbyRecalcBusy") : t(locale, "nearbyRecalc")}
        </Button>
      </div>
      {street ? (
        <p className="text-sm text-muted">
          {t(locale, "nearbyOnRoad")}
          {` · ${street}`}
        </p>
      ) : null}
      {geo === "denied" && !here ? <p className="text-sm text-muted">{t(locale, "nearbyDenied")}</p> : null}

      <SurfaceCard>
        {ordered.map((patient, index) => {
          const located = patient.latitude != null && patient.longitude != null;
          return (
            <div key={patient.id}>
              {index > 0 ? <div className="border-t border-line/70" /> : null}
              <button
                type="button"
                onClick={() => {
                  void openWazeNavigation({
                    ...patient,
                    from: here ? { latitude: here.lat, longitude: here.lng } : null,
                  });
                }}
                className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-start active:bg-surface/70"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    located
                      ? "bg-[#9a4f3c] text-white"
                      : "bg-accent-soft text-accent-strong"
                  }`}
                >
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
                    <span className={`block text-sm font-semibold ${timing ? "text-faint" : "text-ink"}`}>
                      {formatDrive(times[patient.id], locale)}
                    </span>
                  ) : null}
                  <span className="block text-sm font-semibold text-accent">{t(locale, "nearbyItinerary")}</span>
                </span>
              </button>
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
  const address = (patient.address ?? "").trim();
  const city = (patient.city ?? "").trim();
  if (!address) return city;
  if (!city || address === city || address.endsWith(city)) return address;
  return `${address}, ${city}`;
}

function formatDrive(seconds: number, locale: Locale) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return locale === "he" ? `${minutes} דק׳` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (locale === "he") return rest ? `${hours} שע׳ ${rest}` : `${hours} שע׳`;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

/** ~28 km/h urbain — affiché tout de suite, remplacé par OSRM. */
function estimateDriveSeconds(meters: number) {
  return Math.max(60, Math.round((meters / 1000 / 28) * 3600));
}
