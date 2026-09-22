"use client";

import { finiteCoord, wazeNativeHref, wazeNavigateHref } from "@/lib/geo/waze-link";

type WazeTarget = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  from?: { latitude?: number | null; longitude?: number | null } | null;
};

/**
 * Ouvre Waze vers un point déjà sur le réseau Waze.
 * Pas d’adresse en `q` + navigate (souvent « no way to drive »),
 * pas de `from=` (non supporté).
 */
export async function openWazeNavigation(target: WazeTarget) {
  let latitude = finiteCoord(target.latitude);
  let longitude = finiteCoord(target.longitude);
  const fromLat = finiteCoord(target.from?.latitude);
  const fromLng = finiteCoord(target.from?.longitude);

  if (latitude != null && longitude != null) {
    const snapped = await snapOnWaze({
      lat: latitude,
      lng: longitude,
      fromLat,
      fromLng,
    });
    if (snapped) {
      latitude = snapped.lat;
      longitude = snapped.lng;
    }
    openWazeApp(latitude, longitude);
    return true;
  }

  const href = wazeNavigateHref({
    address: target.address,
    city: target.city,
  });
  if (!href) return false;
  window.location.assign(href);
  return true;
}

async function snapOnWaze(input: {
  lat: number;
  lng: number;
  fromLat: number | null;
  fromLng: number | null;
}) {
  try {
    const response = await fetch("/api/nearby/navigate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        lat: input.lat,
        lng: input.lng,
        fromLat: input.fromLat,
        fromLng: input.fromLng,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { lat?: unknown; lng?: unknown };
    const lat = finiteCoord(Number(body.lat));
    const lng = finiteCoord(Number(body.lng));
    if (lat == null || lng == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function openWazeApp(lat: number, lng: number) {
  const native = wazeNativeHref(lat, lng);
  const web = wazeNavigateHref({ latitude: lat, longitude: lng });
  if (!web) return;
  window.location.assign(native);
  window.setTimeout(() => {
    if (document.visibilityState === "visible") window.location.assign(web);
  }, 700);
}
