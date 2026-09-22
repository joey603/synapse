/** Lien Universel Waze (docs Google). Jamais de `from=` ni de live-map. */
export function wazeNavigateHref(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
}) {
  const lat = finiteCoord(input.latitude);
  const lng = finiteCoord(input.longitude);
  if (lat != null && lng != null) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  const q = [input.address, input.city].filter(Boolean).join(", ").trim();
  if (!q) return null;
  // Sans navigate : Waze cherche, l’utilisateur lance. `q` + navigate plante souvent.
  return `https://waze.com/ul?q=${encodeURIComponent(q)}`;
}

export function wazeNativeHref(lat: number, lng: number) {
  return `waze://?ll=${lat},${lng}&navigate=yes`;
}

export function finiteCoord(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1e6) / 1e6;
}
