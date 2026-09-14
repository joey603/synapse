import "server-only";

export async function nearestRoad(point: { lat: number; lng: number }) {
  const url = `https://router.project-osrm.org/nearest/v1/driving/${point.lng.toFixed(6)},${point.lat.toFixed(6)}?number=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("nearest_http");
  const body = (await response.json()) as {
    code?: string;
    waypoints?: Array<{ distance?: number; name?: string; location?: [number, number] }>;
  };
  const hit = body.waypoints?.[0];
  const lng = hit?.location?.[0];
  const lat = hit?.location?.[1];
  if (!hit || body.code !== "Ok" || lng == null || lat == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("nearest_body");
  }
  const distance = hit.distance ?? 0;
  if (distance > 250) return { ...point, name: null as string | null };
  return { lat, lng, name: hit.name?.trim() || null };
}
