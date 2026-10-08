import "server-only";

export type GoogleRouteStep = {
  maneuver: string;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
};

export type GoogleRouteResult = {
  durationSeconds: number;
  distanceMeters: number;
  path: Array<{ lat: number; lng: number }>;
  steps: GoogleRouteStep[];
};

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

/** Itinéraire voiture via Routes API (pas Directions legacy), avec consignes. */
export async function googleDriveRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  languageCode: "fr" | "he" = "fr",
): Promise<GoogleRouteResult | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.polyline.encodedPolyline",
          "routes.legs.steps.navigationInstruction",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.staticDuration",
          "routes.legs.steps.startLocation",
          "routes.legs.steps.endLocation",
        ].join(","),
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        languageCode,
        units: "METRIC",
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{
          steps?: Array<{
            distanceMeters?: number;
            staticDuration?: string;
            startLocation?: { latLng?: { latitude?: number; longitude?: number } };
            endLocation?: { latLng?: { latitude?: number; longitude?: number } };
            navigationInstruction?: { maneuver?: string; instructions?: string };
          }>;
        }>;
      }>;
    };
    const route = body.routes?.[0];
    if (!route) return null;
    const durationSeconds = parseDurationSeconds(route.duration);
    const distanceMeters = route.distanceMeters;
    const encoded = route.polyline?.encodedPolyline;
    if (durationSeconds == null || typeof distanceMeters !== "number" || !encoded) return null;
    const path = decodePolyline(encoded);
    if (path.length < 2) return null;

    const steps: GoogleRouteStep[] = [];
    for (const step of route.legs?.[0]?.steps ?? []) {
      const start = latLng(step.startLocation?.latLng);
      const end = latLng(step.endLocation?.latLng);
      if (!start || !end) continue;
      const instruction = (step.navigationInstruction?.instructions ?? "")
        .split("\n")[0]
        ?.trim();
      if (!instruction) continue;
      steps.push({
        maneuver: step.navigationInstruction?.maneuver ?? "STRAIGHT",
        instruction,
        distanceMeters: step.distanceMeters ?? 0,
        durationSeconds: parseDurationSeconds(step.staticDuration) ?? 0,
        start,
        end,
      });
    }

    return { durationSeconds, distanceMeters, path, steps };
  } catch {
    return null;
  }
}

function latLng(value?: { latitude?: number; longitude?: number }) {
  if (!value) return null;
  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseDurationSeconds(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d+)(?:\.\d+)?s$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

/** Décodage polyline Google Encoded Polyline Algorithm. */
export function decodePolyline(encoded: string) {
  const path: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}
