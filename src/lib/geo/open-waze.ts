"use client";

import { finiteCoord, wazeNavigateHref } from "@/lib/geo/waze-link";

type WazeTarget = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
};

/**
 * Ouvre Waze vers le patient.
 * - Adresse si dispo (Waze géocode mieux qu’un point Nominatim hors route).
 * - Sinon coordonnées calées sur la chaussée.
 * - Jamais de `from=` : Waze part du GPS téléphone (paramètre non documenté → « no way to drive »).
 */
export async function openWazeNavigation(target: WazeTarget) {
  const address = typeof target.address === "string" ? target.address.trim() : "";
  const city = typeof target.city === "string" ? target.city.trim() : "";
  const hasAddress = Boolean(address || city);

  if (hasAddress) {
    const href = wazeNavigateHref({
      address,
      city,
      preferAddress: true,
    });
    if (href) {
      window.location.assign(href);
      return true;
    }
  }

  let latitude = finiteCoord(target.latitude);
  let longitude = finiteCoord(target.longitude);
  if (latitude == null || longitude == null) return false;

  const snapped = await snapRoad({ lat: latitude, lng: longitude });
  if (snapped) {
    latitude = snapped.lat;
    longitude = snapped.lng;
  }

  const href = wazeNavigateHref({ latitude, longitude });
  if (!href) return false;
  window.location.assign(href);
  return true;
}

async function snapRoad(point: { lat: number; lng: number }) {
  try {
    const response = await fetch("/api/nearby/snap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(point),
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
