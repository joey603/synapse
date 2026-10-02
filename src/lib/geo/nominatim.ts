import "server-only";

import { cityCentroid } from "@/lib/geo/city-coords";
import { placeQuery } from "@/lib/geo/place";

const COARSE = new Set(["country", "state", "continent", "county"]);

export async function geocodePlace(address: string | null, city: string | null) {
  const query = placeQuery(address, city);
  if (!query) return cityFallback(city);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "il");
    url.searchParams.set("q", query);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "accept-language": "he,fr,en",
        "user-agent": "Synapse/1.0 (psychiatric home-care documentation)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 429) {
      // Rate-limit : fallback ville pour ne pas bloquer l’UI.
      return cityFallback(city);
    }
    if (!response.ok) return cityFallback(city);

    const text = await response.text();
    if (!text.trim().startsWith("[") && !text.trim().startsWith("{")) {
      return cityFallback(city);
    }

    const rows = JSON.parse(text) as Array<{ lat?: string; lon?: string; addresstype?: string; type?: string }>;
    const hit = rows[0];
    if (!hit) return cityFallback(city);

    const kind = hit.addresstype ?? hit.type ?? "";
    if (address?.trim() && COARSE.has(kind)) return cityFallback(city);

    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return cityFallback(city);
    if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return cityFallback(city);
    return { latitude, longitude };
  } catch {
    return cityFallback(city);
  }
}

function cityFallback(city: string | null) {
  const point = cityCentroid(city);
  if (!point) return null;
  return { latitude: point.lat, longitude: point.lng };
}
