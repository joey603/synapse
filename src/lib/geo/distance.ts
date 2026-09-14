export function haversineMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
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
