import "server-only";

const IL = "https://routing-livemap-il.waze.com/RoutingManager/routingRequest";
const OSRM = "https://router.project-osrm.org";
const cache = new Map<string, { seconds: number; at: number }>();
const CACHE_MS = 5 * 60_000;
const TABLE_CHUNK = 40;

export function clearDriveCache() {
  cache.clear();
}

function cacheKey(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
}

function routingParams(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  geometries: boolean,
) {
  return new URLSearchParams({
    from: `x:${from.lng} y:${from.lat}`,
    to: `x:${to.lng} y:${to.lat}`,
    at: "0",
    returnJSON: "true",
    returnGeometries: geometries ? "true" : "false",
    returnInstructions: "false",
    timeout: "6000",
    nPaths: "1",
    options: "AVOID_TRAILS:t,AVOID_TOLL_ROADS:f,AVOID_FERRIES:f",
  });
}

/** Durée de trajet en secondes (OSRM ; Waze routing IL est souvent 403). */
export async function wazeDriveSeconds(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.seconds;

  const osrm = await osrmRouteSeconds(from, to);
  if (osrm != null) {
    cache.set(key, { seconds: osrm, at: Date.now() });
    return osrm;
  }

  try {
    const seconds = durationSeconds(await askWaze(routingParams(from, to, false)));
    if (seconds != null) {
      cache.set(key, { seconds, at: Date.now() });
      return seconds;
    }
  } catch {
    // endpoint Waze indisponible
  }
  return null;
}

/**
 * Durées origin→chaque destination (même ordre). null = échec pour ce point.
 * Une requête table OSRM par lots — beaucoup plus rapide que N appels Waze.
 */
export async function driveSecondsTable(
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

  for (let start = 0; start < pending.length; start += TABLE_CHUNK) {
    const slice = pending.slice(start, start + TABLE_CHUNK);
    const coords = [
      `${from.lng},${from.lat}`,
      ...slice.map((index) => `${destinations[index]!.lng},${destinations[index]!.lat}`),
    ].join(";");
    try {
      const response = await fetch(
        `${OSRM}/table/v1/driving/${coords}?sources=0&annotations=duration`,
        {
          headers: { "User-Agent": "Synapse" },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        },
      );
      if (!response.ok) continue;
      const body = (await response.json()) as { durations?: Array<Array<number | null>> };
      const row = body.durations?.[0];
      if (!row) continue;
      for (let offset = 0; offset < slice.length; offset += 1) {
        const seconds = row[offset + 1];
        if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) continue;
        const rounded = Math.max(1, Math.round(seconds));
        const index = slice[offset]!;
        out[index] = rounded;
        cache.set(cacheKey(from, destinations[index]!), { seconds: rounded, at: Date.now() });
      }
    } catch {
      // lot suivant
    }
  }

  // Manquants : estimation rapide (pas de N appels séquentiels).
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] != null) continue;
    const estimated = estimateDriveSeconds(from, destinations[i]!);
    out[i] = estimated;
    cache.set(cacheKey(from, destinations[i]!), { seconds: estimated, at: Date.now() });
  }
  return out;
}

/** ~28 km/h urbain (feux inclus), plancher 1 min. */
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

/** Dernier point routable (chaussée), pour éviter « no way to drive ». */
export async function wazeSnapDestination(
  to: { lat: number; lng: number },
  from?: { lat: number; lng: number } | null,
) {
  const nearest = await osrmNearest(to);
  if (nearest) return nearest;

  const origins = from
    ? [from, offset(to, 0.0008, 0), offset(to, 0, 0.0008)]
    : [offset(to, 0.0008, 0), offset(to, 0, 0.0008), offset(to, -0.0008, 0)];

  for (const origin of origins) {
    try {
      const snapped = destinationOnRoute(await askWaze(routingParams(origin, to, true)));
      if (snapped) return snapped;
    } catch {
      // autre origine
    }
  }
  return null;
}

async function askWaze(params: URLSearchParams) {
  const response = await fetch(`${IL}?${params}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.waze.com/",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(2500),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

async function osrmRouteSeconds(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  try {
    const response = await fetch(
      `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`,
      {
        headers: { "User-Agent": "Synapse" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      routes?: Array<{ duration?: unknown }>;
    };
    const duration = body.routes?.[0]?.duration;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return null;
    return Math.round(duration);
  } catch {
    return null;
  }
}

async function osrmNearest(to: { lat: number; lng: number }) {
  try {
    const response = await fetch(`${OSRM}/nearest/v1/driving/${to.lng},${to.lat}`, {
      headers: { "User-Agent": "Synapse" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      waypoints?: Array<{ location?: [number, number] }>;
    };
    const location = body.waypoints?.[0]?.location;
    if (!location) return null;
    const [lng, lat] = location;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < 29 || lat > 34 || lng < 34 || lng > 36.5) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function destinationOnRoute(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const route = (body as { response?: unknown }).response;
  const first = Array.isArray(route) ? route[0] : route;
  if (!first || typeof first !== "object") return null;
  if ((first as { isInvalid?: unknown }).isInvalid === true) return null;
  if ((first as { isBlocked?: unknown }).isBlocked === true) return null;
  const results = (first as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const last = results[results.length - 1];
  if (!last || typeof last !== "object") return null;
  const path = (last as { path?: unknown }).path;
  if (!path || typeof path !== "object") return null;
  const lng = Number((path as { x?: unknown }).x);
  const lat = Number((path as { y?: unknown }).y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 29 || lat > 34 || lng < 34 || lng > 36.5) return null;
  return { lat, lng };
}

function offset(point: { lat: number; lng: number }, dLat: number, dLng: number) {
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

function durationSeconds(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const route = (body as { response?: unknown }).response;
  const first = Array.isArray(route) ? route[0] : route;
  if (!first || typeof first !== "object") return null;
  const total = (first as { totalRouteTime?: unknown }).totalRouteTime;
  if (typeof total === "number" && total > 0) return Math.round(total);
  const results = (first as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;
  const summed = results.reduce((sum, segment) => {
    const seconds = segment && typeof segment === "object" ? (segment as { crossTime?: unknown }).crossTime : 0;
    return sum + (typeof seconds === "number" ? seconds : 0);
  }, 0);
  return summed > 0 ? Math.round(summed) : null;
}
