export function nearestNeighborTour<T extends { latitude: number; longitude: number }>(
  start: { lat: number; lng: number } | null,
  patients: T[],
) {
  const remaining = [...patients];
  const ordered: T[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const patient = remaining[index];
      const score = current
        ? haversineMeters(current, { lat: patient.latitude, lng: patient.longitude })
        : index;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    current = { lat: next.latitude, lng: next.longitude };
  }

  return ordered;
}

function haversineMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earth = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function googleTourHref(
  start: { lat: number; lng: number } | null,
  stops: Array<{ latitude: number; longitude: number }>,
) {
  if (stops.length === 0) return null;
  const parts = [
    ...(start ? [`${start.lat},${start.lng}`] : []),
    ...stops.map((stop) => `${stop.latitude},${stop.longitude}`),
  ];
  return `https://www.google.com/maps/dir/${parts.join("/")}`;
}
