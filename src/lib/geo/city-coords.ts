/** Centroides approximatifs des villes de la tournée (WGS84). */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  לוד: { lat: 31.951, lng: 34.888 },
  lod: { lat: 31.951, lng: 34.888 },
  רמלה: { lat: 31.929, lng: 34.866 },
  ramle: { lat: 31.929, lng: 34.866 },
  ramla: { lat: 31.929, lng: 34.866 },
  "ראשון לציון": { lat: 31.973, lng: 34.792 },
  "rishon lezion": { lat: 31.973, lng: 34.792 },
  אשדוד: { lat: 31.794, lng: 34.650 },
  ashdod: { lat: 31.794, lng: 34.650 },
  יבנה: { lat: 31.878, lng: 34.740 },
  yavne: { lat: 31.878, lng: 34.740 },
  "נס ציונה": { lat: 31.929, lng: 34.798 },
  "ness ziona": { lat: 31.929, lng: 34.798 },
  "גני הדר": { lat: 31.878, lng: 34.851 },
  "ganei hadar": { lat: 31.878, lng: 34.851 },
  ביצרון: { lat: 31.797, lng: 34.728 },
  bitzaron: { lat: 31.797, lng: 34.728 },
  מצליח: { lat: 31.905, lng: 34.871 },
  mazliach: { lat: 31.905, lng: 34.871 },
  "באר יעקב": { lat: 31.943, lng: 34.839 },
};

export function cityCentroid(city: string | null | undefined) {
  if (!city) return null;
  const cleaned = city
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[🚨🧭]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const direct = CITY_COORDS[cleaned] ?? CITY_COORDS[cleaned.toLowerCase()];
  if (direct) return direct;
  const lower = cleaned.toLowerCase();
  for (const [name, point] of Object.entries(CITY_COORDS)) {
    if (cleaned.includes(name) || lower.includes(name.toLowerCase())) return point;
  }
  return null;
}
