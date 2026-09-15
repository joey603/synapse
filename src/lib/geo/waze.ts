import "server-only";

const IL = "https://routing-livemap-il.waze.com/RoutingManager/routingRequest";
const cache = new Map<string, { seconds: number; at: number }>();
const CACHE_MS = 5 * 60_000;

function cacheKey(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
}

/** Durée Waze en secondes. Le parcours n’est ni renvoyé ni journalisé. */
export async function wazeDriveSeconds(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.seconds;

  const params = new URLSearchParams({
    from: `x:${from.lng} y:${from.lat}`,
    to: `x:${to.lng} y:${to.lat}`,
    at: "0",
    returnJSON: "true",
    returnGeometries: "false",
    returnInstructions: "false",
    timeout: "6000",
    nPaths: "1",
    options: "AVOID_TRAILS:t,AVOID_TOLL_ROADS:f,AVOID_FERRIES:f",
  });

  try {
    const seconds = await askWaze(params);
    if (seconds != null) {
      cache.set(key, { seconds, at: Date.now() });
      return seconds;
    }
  } catch {
    // Retry une fois : Waze coupe souvent les lots trop denses.
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
  try {
    const seconds = await askWaze(params);
    if (seconds != null) {
      cache.set(key, { seconds, at: Date.now() });
      return seconds;
    }
  } catch {
    return null;
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
  return durationSeconds(await response.json());
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
