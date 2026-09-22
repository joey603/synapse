/** Lien Universel Waze (docs Google). Pas de `from=` ni de live-map. */
export function wazeNavigateHref(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  /** Si true, privilégie la recherche d’adresse (plus fiable que le centroïde). */
  preferAddress?: boolean;
}) {
  const lat = finiteCoord(input.latitude);
  const lng = finiteCoord(input.longitude);
  const q = [input.address, input.city].filter(Boolean).join(", ").trim();

  if (input.preferAddress && q) {
    return `https://waze.com/ul?${new URLSearchParams({ q, navigate: "yes" }).toString()}`;
  }

  if (lat != null && lng != null) {
    const params = new URLSearchParams({
      ll: `${lat},${lng}`,
      navigate: "yes",
    });
    return `https://waze.com/ul?${params.toString()}`;
  }

  if (!q) return null;
  return `https://waze.com/ul?${new URLSearchParams({ q, navigate: "yes" }).toString()}`;
}

export function finiteCoord(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1e6) / 1e6;
}
