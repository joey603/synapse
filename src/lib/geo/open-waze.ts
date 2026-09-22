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
 * Sur iPhone/iPad : uniquement `waze://` pour ne pas remplacer Synapse par Safari.
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

  const q = [target.address, target.city].filter(Boolean).join(", ").trim();
  if (!q) return false;

  if (isAppleMobile()) {
    launchNativeScheme(`waze://?q=${encodeURIComponent(q)}`);
    return true;
  }

  const href = wazeNavigateHref({ address: target.address, city: target.city });
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

  // iPhone / iPad : jamais le lien https (ça ouvre Safari et on y reste au retour).
  if (isAppleMobile()) {
    launchNativeScheme(native);
    return;
  }

  const web = wazeNavigateHref({ latitude: lat, longitude: lng });
  if (!web) return;
  launchNativeScheme(native);
  window.setTimeout(() => {
    if (document.visibilityState === "visible") window.location.assign(web);
  }, 700);
}

/** Ouvre l’app sans naviguer la page Synapse vers Safari. */
function launchNativeScheme(href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Si le clic <a> est ignoré, bascule encore en waze:// (jamais https).
  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = href;
    }
  }, 400);
}

function isAppleMobile() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS se présente parfois comme Mac.
  return navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform);
}
