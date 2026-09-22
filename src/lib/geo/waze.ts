import "server-only";

const IL = "https://routing-livemap-il.waze.com/RoutingManager/routingRequest";
const cache = new Map<string, { seconds: number; at: number }>();
const CACHE_MS = 5 * 60_000;

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

/** Durée Waze en secondes. Le parcours n’est ni renvoyé ni journalisé. */
export async function wazeDriveSeconds(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.seconds;

  try {
    const seconds = durationSeconds(await askWaze(routingParams(from, to, false)));
    if (seconds != null) {
      cache.set(key, { seconds, at: Date.now() });
      return seconds;
    }
  } catch {
    // Retry une fois : Waze coupe souvent les lots trop denses.
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
  try {
    const seconds = durationSeconds(await askWaze(routingParams(from, to, false)));
    if (seconds != null) {
      cache.set(key, { seconds, at: Date.now() });
      return seconds;
    }
  } catch {
    return null;
  }
  return null;
}

/** Dernier point Waze routable (chaussée), pour éviter « no way to drive ». */
export async function wazeSnapDestination(
  to: { lat: number; lng: number },
  from?: { lat: number; lng: number } | null,
) {
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
      "User-Agent": "Synapse",
      Referer: "https://www.waze.com/",
    },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
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
