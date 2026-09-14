import "server-only";

import { placeQuery } from "@/lib/geo/place";

const COARSE = new Set(["country", "state", "continent", "county"]);

export async function geocodePlace(address: string | null, city: string | null) {
  const query = placeQuery(address, city);
  if (!query) return null;

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
  if (!response.ok) throw new Error("geocode_http");

  const rows = (await response.json()) as Array<{ lat?: string; lon?: string; addresstype?: string; type?: string }>;
  const hit = rows[0];
  if (!hit) return null;

  const kind = hit.addresstype ?? hit.type ?? "";
  if (address?.trim() && COARSE.has(kind)) return null;

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return null;
  return { latitude, longitude };
}
