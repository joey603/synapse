import "server-only";

import { placeQuery } from "@/lib/geo/place";

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

/** Géocodage rue via Google Geocoding API. null si indisponible / échec. */
export async function geocodePlaceGoogle(address: string | null, city: string | null) {
  const key = apiKey();
  if (!key) return null;
  const query = placeQuery(address, city);
  if (!query) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("region", "il");
    url.searchParams.set("language", "he");
    url.searchParams.set("key", key);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      status?: string;
      results?: Array<{
        geometry?: {
          location?: { lat?: number; lng?: number };
          location_type?: string;
        };
        partial_match?: boolean;
      }>;
    };
    if (body.status !== "OK" && body.status !== "ZERO_RESULTS") return null;
    const hit = body.results?.[0];
    const lat = hit?.geometry?.location?.lat;
    const lng = hit?.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < 29 || lat > 34 || lng < 34 || lng > 36.5) return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}
