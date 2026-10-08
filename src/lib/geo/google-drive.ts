import "server-only";

const cache = new Map<string, { seconds: number; at: number }>();
const CACHE_MS = 5 * 60_000;
/** Routes API computeRouteMatrix : lots raisonnables. */
const CHUNK = 25;

export function clearGoogleDriveCache() {
  cache.clear();
}

function cacheKey(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
}

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

/**
 * Durées origin→chaque destination (même ordre).
 * Utilise Routes API (computeRouteMatrix) — remplace Distance Matrix legacy.
 */
export async function googleDriveSecondsTable(
  from: { lat: number; lng: number },
  destinations: Array<{ lat: number; lng: number }>,
) {
  const out: Array<number | null> = destinations.map(() => null);
  if (destinations.length === 0) return out;

  const pending: number[] = [];
  for (let i = 0; i < destinations.length; i += 1) {
    const key = cacheKey(from, destinations[i]!);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      out[i] = hit.seconds;
    } else {
      pending.push(i);
    }
  }

  const key = apiKey();
  if (!key) {
    for (const index of pending) {
      const estimated = estimateDriveSeconds(from, destinations[index]!);
      out[index] = estimated;
      cache.set(cacheKey(from, destinations[index]!), { seconds: estimated, at: Date.now() });
    }
    return out;
  }

  for (let start = 0; start < pending.length; start += CHUNK) {
    const slice = pending.slice(start, start + CHUNK);
    try {
      const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,status",
        },
        body: JSON.stringify({
          origins: [
            {
              waypoint: {
                location: { latLng: { latitude: from.lat, longitude: from.lng } },
              },
            },
          ],
          destinations: slice.map((index) => ({
            waypoint: {
              location: {
                latLng: {
                  latitude: destinations[index]!.lat,
                  longitude: destinations[index]!.lng,
                },
              },
            },
          })),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
        }),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const body = (await response.json()) as Array<{
        originIndex?: number;
        destinationIndex?: number;
        duration?: string;
        status?: { code?: number };
      }>;
      if (!Array.isArray(body)) continue;
      for (const row of body) {
        const destIndex = row.destinationIndex;
        if (typeof destIndex !== "number" || destIndex < 0 || destIndex >= slice.length) continue;
        if (row.status && typeof row.status.code === "number" && row.status.code !== 0) continue;
        const seconds = parseDurationSeconds(row.duration);
        if (seconds == null) continue;
        const rounded = Math.max(1, seconds);
        const index = slice[destIndex]!;
        out[index] = rounded;
        cache.set(cacheKey(from, destinations[index]!), { seconds: rounded, at: Date.now() });
      }
    } catch {
      // lot suivant
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    if (out[i] != null) continue;
    const estimated = estimateDriveSeconds(from, destinations[i]!);
    out[i] = estimated;
    cache.set(cacheKey(from, destinations[i]!), { seconds: estimated, at: Date.now() });
  }
  return out;
}

/** "2519s" → 2519 */
function parseDurationSeconds(value: string | undefined) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d+)(?:\.\d+)?s$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

function estimateDriveSeconds(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const meters = haversineMeters(from, to);
  return Math.max(60, Math.round((meters / 1000 / 28) * 3600));
}

function haversineMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * toRad;
  const dLng = (to.lng - from.lng) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * toRad) * Math.cos(to.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}
