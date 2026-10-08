"use client";

import { useEffect, useRef, useState } from "react";

import { haversineMeters } from "@/lib/geo/distance";
import {
  FLAT_MAP_STYLES,
  loadGoogleMaps,
  publicGoogleMapsKey,
  type GoogleMap,
  type GoogleMarker,
  type GooglePolyline,
} from "@/lib/geo/load-google-maps";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { setTripFocusActive } from "@/lib/ui/trip-focus";

import type { NearbyPatient } from "./types";

const PIN_BROWN = "#9a4f3c";
const ME_BLUE = "#1e4d6b";
const GMAPS_BLUE = "#1a73e8";
const GMAPS_GREEN = "#188038";
const ARRIVE_METERS = 45;
const STEP_ADVANCE_METERS = 40;
const REROUTE_METERS = 80;
const REROUTE_MIN_MS = 20_000;
const GPS_ZOOM = 18;
/** Perspective type Google Maps nav (0 = vue du dessus). */
const GPS_TILT = 67.5;
/** Décalage caméra vers l’avant pour voir la route comme Google Maps. */
const LOOK_AHEAD_M = 70;

type RouteStep = {
  maneuver: string;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
};

type RouteInfo = {
  durationText: string;
  distanceText: string;
  durationSeconds: number;
  distanceMeters: number;
  path: Array<{ lat: number; lng: number }>;
  steps: RouteStep[];
};

export function TripFocusOverlay({
  locale,
  patient,
  here,
  heading,
  fromRect,
  onClose,
}: {
  locale: Locale;
  patient: NearbyPatient;
  here: { lat: number; lng: number } | null;
  heading: number | null;
  fromRect: DOMRect | null;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const meMarkerRef = useRef<GoogleMarker | null>(null);
  const patientMarkerRef = useRef<GoogleMarker | null>(null);
  const etaMarkerRef = useRef<GoogleMarker | null>(null);
  const polylineRef = useRef<GooglePolyline | null>(null);
  const hereRef = useRef(here);
  const routeRef = useRef<RouteInfo | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const fittedRef = useRef(false);
  const routeRequestedRef = useRef(false);
  const navigatingRef = useRef(false);
  const followRef = useRef(true);
  const lastRerouteAt = useRef(0);
  const lastRerouteFrom = useRef<{ lat: number; lng: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [follow, setFollow] = useState(true);

  const destLat = patient.latitude;
  const destLng = patient.longitude;
  const dest =
    destLat != null && destLng != null ? { lat: destLat, lng: destLng } : null;
  const name = `${patient.firstName} ${patient.lastName}`.trim();
  hereRef.current = here;
  routeRef.current = route;
  navigatingRef.current = navigating;
  followRef.current = follow;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !fromRect) {
      el.style.inset = "0";
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.borderRadius = "0";
      setExpanded(true);
      return;
    }

    el.style.position = "fixed";
    el.style.top = `${fromRect.top}px`;
    el.style.left = `${fromRect.left}px`;
    el.style.width = `${fromRect.width}px`;
    el.style.height = `${fromRect.height}px`;
    el.style.borderRadius = "16px";
    el.style.transition =
      "top 380ms cubic-bezier(.2,.8,.2,1), left 380ms cubic-bezier(.2,.8,.2,1), width 380ms cubic-bezier(.2,.8,.2,1), height 380ms cubic-bezier(.2,.8,.2,1), border-radius 380ms ease";

    const frame = window.requestAnimationFrame(() => {
      el.style.top = "0";
      el.style.left = "0";
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.borderRadius = "0";
    });
    const done = window.setTimeout(() => setExpanded(true), 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [fromRect]);

  useEffect(() => {
    setTripFocusActive(true);
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      setTripFocusActive(false);
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  function applyRouteOnMap(map: GoogleMap, info: RouteInfo, opts: { fit: boolean }) {
    if (!window.google?.maps) return;
    const g = window.google.maps;

    polylineRef.current?.setMap(null);
    polylineRef.current = new g.Polyline({
      map,
      path: info.path,
      strokeColor: GMAPS_BLUE,
      strokeOpacity: 0.95,
      strokeWeight: navigatingRef.current ? 10 : 5,
    });

    if (navigatingRef.current) {
      etaMarkerRef.current?.setMap(null);
    } else {
      placeEtaMarker(map, info);
    }

    if (opts.fit && !fittedRef.current && !navigatingRef.current) {
      const bounds = new g.LatLngBounds();
      for (const point of info.path) bounds.extend(point);
      map.fitBounds(bounds, 72);
      fittedRef.current = true;
    }
  }

  function placeEtaMarker(map: GoogleMap, info: RouteInfo) {
    if (!window.google?.maps) return;
    const g = window.google.maps;
    const position = offsetAbovePath(info.path);
    if (!position) return;

    const minutes = Math.max(1, Math.round(info.durationSeconds / 60));
    const short =
      minutes < 60
        ? locale === "he"
          ? `${minutes}׳`
          : `${minutes}′`
        : info.durationText;

    etaMarkerRef.current?.setMap(null);
    etaMarkerRef.current = new g.Marker({
      map,
      position,
      title: info.durationText,
      zIndex: 900,
      label: { text: short, color: "#ffffff", fontWeight: "700" },
      icon: {
        path: g.SymbolPath.CIRCLE,
        fillColor: ME_BLUE,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 18,
      },
    });
  }

  async function fetchRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<RouteInfo | null> {
    const response = await fetch("/api/nearby-v2/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
        locale,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      durationSeconds?: number;
      distanceMeters?: number;
      path?: Array<{ lat: number; lng: number }>;
      steps?: RouteStep[];
    };
    const path = body.path ?? [];
    if (path.length < 2) return null;
    const durationSeconds = body.durationSeconds ?? 0;
    const distanceMeters = body.distanceMeters ?? 0;
    return {
      path,
      steps: body.steps ?? [],
      durationSeconds,
      distanceMeters,
      durationText: formatDuration(durationSeconds, locale),
      distanceText: formatDistance(distanceMeters, locale),
    };
  }

  useEffect(() => {
    const key = publicGoogleMapsKey();
    if (!key || !mapNode.current) return;
    if (destLat == null || destLng == null) return;
    let cancelled = false;
    fittedRef.current = false;
    routeRequestedRef.current = false;
    const destPos = { lat: destLat, lng: destLng };
    const startHere = hereRef.current;

    void (async () => {
      try {
        await loadGoogleMaps(key);
      } catch {
        if (!cancelled) setRouteError(true);
        return;
      }
      if (cancelled || !mapNode.current || !window.google?.maps) return;

      const g = window.google.maps;
      const center = startHere ?? destPos;
      const vector = g.RenderingType?.VECTOR ?? "VECTOR";
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || undefined;
      const map = new g.Map(mapNode.current, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
        tilt: 0,
        heading: 0,
        // VECTOR = vraie perspective GPS (raster reste vue du dessus).
        renderingType: vector,
        tiltInteractionEnabled: true,
        headingInteractionEnabled: true,
        isFractionalZoomEnabled: true,
        ...(mapId
          ? { mapId }
          : { styles: FLAT_MAP_STYLES }),
      });
      mapRef.current = map;
      g.event.addListener?.(map, "dragstart", () => {
        if (navigatingRef.current) setFollow(false);
      });

      if (startHere) {
        meMarkerRef.current = new g.Marker({
          map,
          position: startHere,
          title: t(locale, "nearbyMe"),
          zIndex: 1000,
          icon: meIcon(g, false),
        });
      }

      patientMarkerRef.current = new g.Marker({
        map,
        position: destPos,
        title: name,
        label: { text: "1", color: "#ffffff", fontWeight: "700" },
        icon: {
          path: g.SymbolPath.CIRCLE,
          fillColor: PIN_BROWN,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 14,
        },
      });

      if (startHere) {
        routeRequestedRef.current = true;
        try {
          const info = await fetchRoute(startHere, destPos);
          if (cancelled) return;
          if (!info) throw new Error("route");
          applyRouteOnMap(map, info, { fit: true });
          setRoute(info);
          setRouteError(false);
          lastRerouteFrom.current = startHere;
          lastRerouteAt.current = Date.now();
        } catch {
          if (cancelled) return;
          setRouteError(true);
          if (!fittedRef.current) {
            const bounds = new g.LatLngBounds();
            bounds.extend(startHere);
            bounds.extend(destPos);
            map.fitBounds(bounds, 64);
            fittedRef.current = true;
          }
        }
      } else {
        map.setCenter(destPos);
        map.setZoom(15);
        fittedRef.current = true;
        setRouteError(true);
      }
    })();

    return () => {
      cancelled = true;
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      etaMarkerRef.current?.setMap(null);
      etaMarkerRef.current = null;
      meMarkerRef.current?.setMap(null);
      patientMarkerRef.current?.setMap(null);
      meMarkerRef.current = null;
      patientMarkerRef.current = null;
      mapRef.current = null;
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destLat, destLng, locale, name]);

  useEffect(() => {
    if (!here || !window.google?.maps) return;
    const map = mapRef.current;
    if (!map) return;
    const g = window.google.maps;

    if (!meMarkerRef.current) {
      meMarkerRef.current = new g.Marker({
        map,
        position: here,
        title: t(locale, "nearbyMe"),
        zIndex: 1000,
        icon: meIcon(g, navigating),
      });
    } else {
      meMarkerRef.current.setPosition(here);
    }

    if (!navigating || destLat == null || destLng == null) {
      lastPosRef.current = here;
      return;
    }

    const steps = routeRef.current?.steps ?? [];
    const nextIdx = advanceStepIndex(steps, here, stepIndex);
    if (nextIdx !== stepIndex) setStepIndex(nextIdx);

    const course = resolveHeading({
      gpsHeading: heading,
      here,
      last: lastPosRef.current,
      path: routeRef.current?.path ?? null,
      stepEnd: steps[nextIdx]?.end ?? null,
    });
    lastPosRef.current = here;

    // Carte déjà orientée (heading) → flèche vers le haut de l’écran.
    meMarkerRef.current?.setIcon(meIcon(g, true, 0));
    if (followRef.current) applyGpsCamera(map, here, course);

    const destPos = { lat: destLat, lng: destLng };
    if (haversineMeters(here, destPos) <= ARRIVE_METERS) {
      setArrived(true);
      setNavigating(false);
      exitGpsCamera(map);
    }
  }, [here, heading, navigating, destLat, destLng, locale, stepIndex]);

  useEffect(() => {
    if (!navigating || !here || destLat == null || destLng == null) return;

    const now = Date.now();
    const movedEnough =
      !lastRerouteFrom.current ||
      haversineMeters(lastRerouteFrom.current, here) >= REROUTE_METERS;
    const cooledDown = now - lastRerouteAt.current >= REROUTE_MIN_MS;
    if (!movedEnough || !cooledDown) return;

    lastRerouteAt.current = now;
    lastRerouteFrom.current = here;
    const from = here;
    const to = { lat: destLat, lng: destLng };
    let alive = true;

    void (async () => {
      try {
        const info = await fetchRoute(from, to);
        if (!alive || !info || !mapRef.current || !navigatingRef.current) return;
        applyRouteOnMap(mapRef.current, info, { fit: false });
        setRoute(info);
        setStepIndex(0);
        setRouteError(false);
      } catch {
        // Garde le tracé précédent.
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, navigating, destLat, destLng, locale]);

  useEffect(() => {
    if (!here || destLat == null || destLng == null) return;
    if (route || polylineRef.current || routeRequestedRef.current) return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    routeRequestedRef.current = true;
    let cancelled = false;
    const from = here;
    const to = { lat: destLat, lng: destLng };

    void (async () => {
      try {
        const info = await fetchRoute(from, to);
        if (cancelled || !info || !mapRef.current) {
          if (!cancelled) routeRequestedRef.current = false;
          return;
        }
        applyRouteOnMap(mapRef.current, info, { fit: true });
        setRoute(info);
        setRouteError(false);
        lastRerouteFrom.current = from;
        lastRerouteAt.current = Date.now();
      } catch {
        if (!cancelled) routeRequestedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, destLat, destLng, route, locale]);

  function onStartTrip() {
    if (!dest || !here || !mapRef.current || !window.google?.maps) return;
    setArrived(false);
    setNavigating(true);
    setFollow(true);
    setStepIndex(0);
    etaMarkerRef.current?.setMap(null);
    const course = resolveHeading({
      gpsHeading: heading,
      here,
      last: lastPosRef.current,
      path: routeRef.current?.path ?? null,
      stepEnd: routeRef.current?.steps[0]?.end ?? null,
    });
    if (meMarkerRef.current) {
      meMarkerRef.current.setIcon(meIcon(window.google.maps, true, 0));
    }
    if (polylineRef.current && route) {
      applyRouteOnMap(mapRef.current, route, { fit: false });
    }
    // Double tick : le tilt VECTOR s’applique mieux après le zoom.
    applyGpsCamera(mapRef.current, here, course);
    window.requestAnimationFrame(() => {
      if (mapRef.current && hereRef.current && navigatingRef.current) {
        applyGpsCamera(mapRef.current, hereRef.current, course);
      }
    });
    lastRerouteFrom.current = here;
    lastRerouteAt.current = 0;
  }

  function onStopTrip() {
    setNavigating(false);
    setFollow(true);
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    exitGpsCamera(map);
    if (here && meMarkerRef.current) {
      meMarkerRef.current.setMap(null);
      meMarkerRef.current = new window.google.maps.Marker({
        map,
        position: here,
        title: t(locale, "nearbyMe"),
        zIndex: 1000,
        icon: meIcon(window.google.maps, false),
      });
    }
    if (route?.path.length) {
      fittedRef.current = false;
      applyRouteOnMap(map, route, { fit: true });
    }
  }

  function onRecenter() {
    if (!here || !mapRef.current) return;
    setFollow(true);
    const course = resolveHeading({
      gpsHeading: heading,
      here,
      last: lastPosRef.current,
      path: routeRef.current?.path ?? null,
      stepEnd: routeRef.current?.steps[stepIndex]?.end ?? null,
    });
    applyGpsCamera(mapRef.current, here, course);
  }

  const step = route?.steps[stepIndex] ?? null;
  const nextStep = route?.steps[stepIndex + 1] ?? null;
  const metersToManeuver =
    here && step ? Math.max(0, Math.round(haversineMeters(here, step.end))) : step?.distanceMeters ?? null;
  const remainingSeconds = remainingDuration(route?.steps ?? [], stepIndex, metersToManeuver);
  const remainingMeters = remainingDistance(route?.steps ?? [], stepIndex, metersToManeuver);
  const navDurationText = formatDuration(remainingSeconds || route?.durationSeconds || 0, locale);
  const navDistanceText = formatDistance(remainingMeters || route?.distanceMeters || 0, locale);
  const arrivalTime = formatArrivalClock(remainingSeconds || route?.durationSeconds || 0, locale);
  const primaryInstruction = step ? primaryInstructionLine(step.instruction) : "";
  const secondaryStreet = step ? streetFromInstruction(step.instruction) : "";

  return (
    <div
      ref={host}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden overscroll-none bg-card shadow-2xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ inset: fromRect ? undefined : 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t(locale, "nearbyTripTitle")}
    >
      <div className="relative min-h-0 flex-1">
        <div ref={mapNode} className="absolute inset-0 bg-[#d5dde3]" />

        {!navigating ? (
          <div
            className={`absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-start gap-2 transition-opacity duration-300 ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/95 text-ink shadow-md ring-1 ring-line"
              aria-label={t(locale, "nearbyTripClose")}
            >
              ✕
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-synapse-md bg-card/95 px-3 py-2.5 shadow-md ring-1 ring-line backdrop-blur-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {arrived
                    ? t(locale, "nearbyTripArrived")
                    : here
                      ? t(locale, "nearbyTripTo").replace("{name}", name)
                      : t(locale, "nearbyTripNeedGps")}
                </p>
                {routeError && !route ? (
                  <p className="mt-1 text-xs text-faint">{t(locale, "nearbyTripRouteFail")}</p>
                ) : null}
              </div>
              {route ? (
                <div className="shrink-0 rounded-synapse-sm bg-accent px-2.5 py-1.5 text-center">
                  <p className="text-sm font-bold leading-none text-white">{route.durationText}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-white/85">{route.distanceText}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {/* Bannière consignes — style Google Maps Navigation */}
            <div
              className={`absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 transition-opacity duration-300 ${
                expanded ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="overflow-hidden rounded-2xl bg-[#188038] text-white shadow-[0_4px_24px_rgba(0,0,0,0.28)]">
                <div className="flex items-stretch gap-3 px-3 py-3.5">
                  <div className="flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl bg-black/15 px-1 py-2">
                    <ManeuverIcon maneuver={step?.maneuver} className="h-9 w-9" />
                    {metersToManeuver != null ? (
                      <span className="mt-1.5 text-sm font-bold tabular-nums leading-none">
                        {formatNavDistance(metersToManeuver, locale)}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 self-center">
                    <p className="text-lg font-bold leading-snug tracking-tight">
                      {primaryInstruction ||
                        t(locale, "nearbyTripNavigating").replace("{name}", name)}
                    </p>
                    {secondaryStreet ? (
                      <p className="mt-1 truncate text-sm font-medium text-white/90">{secondaryStreet}</p>
                    ) : null}
                  </div>
                </div>
                {nextStep ? (
                  <div className="flex items-center gap-2.5 bg-[#0f6b2f] px-3 py-2 text-sm">
                    <span className="shrink-0 font-medium text-white/85">{t(locale, "nearbyTripThen")}</span>
                    <ManeuverIcon maneuver={nextStep.maneuver} className="h-5 w-5 shrink-0" />
                    <span className="truncate font-semibold">
                      {primaryInstructionLine(nextStep.instruction)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {!follow ? (
              <button
                type="button"
                onClick={onRecenter}
                className="absolute bottom-[7.75rem] start-3 z-10 flex items-center gap-2 rounded-full bg-white px-3.5 py-2.5 text-sm font-semibold text-[#1a73e8] shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
              >
                <span className="text-base leading-none" aria-hidden>
                  ➤
                </span>
                {t(locale, "nearbyTripRecenter")}
              </button>
            ) : null}

            {/* Barre ETA bas — comme Google Maps */}
            <div
              className={`absolute inset-x-0 bottom-0 z-10 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] transition-opacity duration-300 ${
                expanded ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onStopTrip}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3c4043] text-lg text-white"
                  aria-label={t(locale, "nearbyTripStop")}
                >
                  ✕
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[1.75rem] font-bold leading-none" style={{ color: GMAPS_GREEN }}>
                    {navDurationText}
                  </p>
                  <p className="mt-1 truncate text-[15px] text-[#5f6368]">
                    {navDistanceText} · {arrivalTime}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!navigating ? (
        <div
          className={`border-t border-line bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-opacity duration-300 ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            disabled={!dest || !here || arrived}
            onClick={onStartTrip}
            className="flex min-h-12 w-full items-center justify-center rounded-synapse-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {arrived ? t(locale, "nearbyTripArrived") : t(locale, "nearbyTripStart")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function meIcon(
  g: NonNullable<Window["google"]>["maps"],
  navigating: boolean,
  rotation = 0,
) {
  if (navigating) {
    return {
      path: "M 0,-14 L 9,12 L 0,6 L -9,12 Z",
      fillColor: GMAPS_BLUE,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2.5,
      scale: 1.7,
      rotation,
    };
  }
  return {
    path: g.SymbolPath.CIRCLE,
    fillColor: ME_BLUE,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
    scale: 11,
  };
}

function applyGpsCamera(
  map: GoogleMap,
  pos: { lat: number; lng: number },
  course: number | null,
) {
  const heading = course ?? 0;
  // Centre un peu devant le véhicule → route devant comme Google Maps.
  const center = offsetByBearing(pos, heading, LOOK_AHEAD_M);
  map.setOptions({
    gestureHandling: "greedy",
    rotateControl: false,
    zoomControl: false,
    tiltInteractionEnabled: true,
    headingInteractionEnabled: true,
  });
  if (map.moveCamera) {
    map.moveCamera({
      center,
      zoom: GPS_ZOOM,
      tilt: GPS_TILT,
      heading,
    });
    return;
  }
  map.setCenter(center);
  map.setZoom(GPS_ZOOM);
  map.setTilt(GPS_TILT);
  map.setHeading(heading);
}

function exitGpsCamera(map: GoogleMap) {
  if (map.moveCamera) {
    map.moveCamera({ tilt: 0, heading: 0, zoom: 14 });
  } else {
    map.setTilt(0);
    map.setHeading(0);
  }
  map.setOptions({
    gestureHandling: "greedy",
    rotateControl: false,
    zoomControl: true,
  });
}

function advanceStepIndex(steps: RouteStep[], here: { lat: number; lng: number }, current: number) {
  if (!steps.length) return 0;
  let index = Math.min(Math.max(current, 0), steps.length - 1);
  while (index < steps.length - 1 && haversineMeters(here, steps[index]!.end) <= STEP_ADVANCE_METERS) {
    index += 1;
  }
  return index;
}

function resolveHeading({
  gpsHeading,
  here,
  last,
  path,
  stepEnd,
}: {
  gpsHeading: number | null;
  here: { lat: number; lng: number };
  last: { lat: number; lng: number } | null;
  path: Array<{ lat: number; lng: number }> | null;
  stepEnd: { lat: number; lng: number } | null;
}) {
  if (gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0) return gpsHeading;
  if (last && haversineMeters(last, here) >= 4) return bearingDegrees(last, here);
  if (stepEnd) return bearingDegrees(here, stepEnd);
  if (path && path.length >= 2) {
    const ahead = nearestAhead(path, here);
    if (ahead) return bearingDegrees(here, ahead);
  }
  return null;
}

function nearestAhead(path: Array<{ lat: number; lng: number }>, here: { lat: number; lng: number }) {
  let bestI = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length; i++) {
    const point = path[i]!;
    const d = haversineMeters(here, point);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return path[Math.min(path.length - 1, bestI + 4)] ?? path[path.length - 1] ?? null;
}

function bearingDegrees(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function ManeuverIcon({ maneuver, className }: { maneuver?: string; className?: string }) {
  const kind = maneuverKind(maneuver);
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {kind === "left" ? (
        <path d="M15 5v4H8.4l2.3-2.3L9.3 5.3 4 10.6l5.3 5.3 1.4-1.4L8.4 12H17V5h-2z" />
      ) : null}
      {kind === "right" ? (
        <path d="M9 5v4h6.6l-2.3-2.3 1.4-1.4L20 10.6l-5.3 5.3-1.4-1.4 2.3-2.3H7V5h2z" />
      ) : null}
      {kind === "uturn" ? (
        <path d="M12 5a6 6 0 0 0-6 6v6h2v-6a4 4 0 0 1 8 0v3h-2l3 4 3-4h-2v-3a6 6 0 0 0-6-6z" />
      ) : null}
      {kind === "round" ? (
        <path d="M12 4a8 8 0 1 0 7.5 10.7l-1.9-.7A6 6 0 1 1 12 6V4zm1 2.1 3.5 3.4-1.4 1.4-1.1-1.1V14h-2V9.8l-1.1 1.1-1.4-1.4L13 6.1z" />
      ) : null}
      {kind === "straight" ? <path d="M12 3.5 6.5 9h3.5v11h4V9h3.5L12 3.5z" /> : null}
    </svg>
  );
}

function maneuverKind(maneuver?: string): "left" | "right" | "uturn" | "round" | "straight" {
  switch (maneuver) {
    case "TURN_LEFT":
    case "TURN_SLIGHT_LEFT":
    case "TURN_SHARP_LEFT":
    case "RAMP_LEFT":
    case "FORK_LEFT":
      return "left";
    case "TURN_RIGHT":
    case "TURN_SLIGHT_RIGHT":
    case "TURN_SHARP_RIGHT":
    case "RAMP_RIGHT":
    case "FORK_RIGHT":
      return "right";
    case "UTURN_LEFT":
    case "UTURN_RIGHT":
      return "uturn";
    case "ROUNDABOUT_LEFT":
    case "ROUNDABOUT_RIGHT":
      return "round";
    default:
      return "straight";
  }
}

function primaryInstructionLine(instruction: string) {
  const first = instruction.split(/[,·\n]/)[0]?.trim() ?? instruction;
  return first;
}

function streetFromInstruction(instruction: string) {
  const match =
    instruction.match(/\bsur\s+(.+)$/i) ||
    instruction.match(/\bon\s+(.+)$/i) ||
    instruction.match(/\bעל\s+(.+)$/);
  const street = match?.[1]?.trim();
  if (!street || street.length < 2) return "";
  if (street.toLowerCase() === instruction.toLowerCase()) return "";
  return street;
}

function remainingDuration(steps: RouteStep[], index: number, metersToManeuver: number | null) {
  if (!steps.length) return 0;
  let total = 0;
  for (let i = Math.max(0, index); i < steps.length; i++) {
    const step = steps[i]!;
    if (i === index && metersToManeuver != null && step.distanceMeters > 0) {
      const ratio = Math.min(1, metersToManeuver / step.distanceMeters);
      total += step.durationSeconds * ratio;
    } else if (i > index) {
      total += step.durationSeconds;
    }
  }
  return Math.max(30, Math.round(total));
}

function remainingDistance(steps: RouteStep[], index: number, metersToManeuver: number | null) {
  if (!steps.length) return 0;
  let total = metersToManeuver ?? steps[index]?.distanceMeters ?? 0;
  for (let i = index + 1; i < steps.length; i++) total += steps[i]!.distanceMeters;
  return Math.max(0, Math.round(total));
}

function offsetByBearing(
  pos: { lat: number; lng: number },
  bearingDeg: number,
  meters: number,
) {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng =
    (meters * Math.sin(rad)) / (111_320 * Math.max(0.2, Math.cos((pos.lat * Math.PI) / 180)));
  return { lat: pos.lat + dLat, lng: pos.lng + dLng };
}

function formatNavDistance(meters: number, locale: Locale) {
  if (meters < 1000) {
    const rounded = meters < 50 ? Math.round(meters / 10) * 10 : Math.round(meters / 50) * 50;
    return locale === "he" ? `${rounded} מ׳` : `${rounded} m`;
  }
  return formatDistance(meters, locale);
}

function offsetAbovePath(path: Array<{ lat: number; lng: number }>) {
  const i = Math.floor(path.length / 2);
  const mid = path[i];
  if (!mid) return null;

  let minLat = mid.lat;
  let maxLat = mid.lat;
  let minLng = mid.lng;
  let maxLng = mid.lng;
  for (const point of path) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  const spanLat = Math.max(0.01, maxLat - minLat);
  const spanLng = Math.max(0.01, maxLng - minLng);
  const offsetLat = Math.max(spanLat * 0.12, spanLng * 0.08, 0.015);
  return { lat: mid.lat + offsetLat, lng: mid.lng };
}

function formatDuration(seconds: number, locale: Locale) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return locale === "he" ? `${minutes} דק׳` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (locale === "he") return rest ? `${hours} שע׳ ${rest}` : `${hours} שע׳`;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

function formatDistance(meters: number, locale: Locale) {
  if (meters < 1000) {
    const m = Math.round(meters);
    return locale === "he" ? `${m} מ׳` : `${m} m`;
  }
  const km = (meters / 1000).toFixed(1).replace(/\.0$/, "");
  return locale === "he" ? `${km} ק״מ` : `${km} km`;
}

function formatArrivalClock(durationSeconds: number, locale: Locale) {
  const at = new Date(Date.now() + durationSeconds * 1000);
  return at.toLocaleTimeString(locale === "he" ? "he-IL" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
