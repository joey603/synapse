/** Lien Google Maps Directions (web / app). */
export function googleNavigateHref(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  from?: { latitude?: number | null; longitude?: number | null } | null;
  /** Lance le guidage GPS Google Maps. */
  navigate?: boolean;
}) {
  const lat = finiteCoord(input.latitude);
  const lng = finiteCoord(input.longitude);
  const params = new URLSearchParams({ api: "1", travelmode: "driving" });

  if (lat != null && lng != null) {
    params.set("destination", `${lat},${lng}`);
  } else {
    const q = placeQuery(input.address, input.city);
    if (!q) return null;
    params.set("destination", q);
  }

  const fromLat = finiteCoord(input.from?.latitude);
  const fromLng = finiteCoord(input.from?.longitude);
  if (fromLat != null && fromLng != null) {
    params.set("origin", `${fromLat},${fromLng}`);
  }
  if (input.navigate) {
    params.set("dir_action", "navigate");
  }

  return `https://www.google.com/maps/dir/?${params}`;
}

export function openGoogleNavigation(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  from?: { latitude?: number | null; longitude?: number | null } | null;
  navigate?: boolean;
}) {
  const href = googleNavigateHref(input);
  if (!href) return false;
  window.location.assign(href);
  return true;
}

function placeQuery(address: string | null | undefined, city: string | null | undefined) {
  const street = (address ?? "").trim();
  const town = (city ?? "").trim();
  if (!street) return town || null;
  if (!town || street === town || street.endsWith(town)) return street;
  return `${street}, ${town}`;
}

function finiteCoord(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1e6) / 1e6;
}
