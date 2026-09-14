import "server-only";

const SERVERS = [
  "https://routing-livemap-il.waze.com/RoutingManager/routingRequest",
  "https://routing-livemap-row.waze.com/RoutingManager/routingRequest",
];

/** Durée Waze en secondes. Le parcours n’est ni renvoyé ni journalisé. */
export async function wazeDriveSeconds(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const params = new URLSearchParams({
    from: `x:${from.lng} y:${from.lat}`,
    to: `x:${to.lng} y:${to.lat}`,
    at: "0",
    returnJSON: "true",
    returnGeometries: "false",
    returnInstructions: "false",
    timeout: "20000",
    nPaths: "1",
    options: "AVOID_TRAILS:t,AVOID_TOLL_ROADS:f,AVOID_FERRIES:f",
  });

  for (const server of SERVERS) {
    try {
      const response = await fetch(`${server}?${params}`, {
        headers: {
          "User-Agent": "Synapse",
          Referer: "https://www.waze.com/",
        },
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const seconds = durationSeconds(await response.json());
      if (seconds != null) return seconds;
    } catch {
      // Serveur suivant.
    }
  }

  return null;
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
