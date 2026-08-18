import type { LatLng, Place } from './map';

export type AmenityKind = 'restaurant' | 'rest area';

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Detect an on-demand amenity request. Returns null for ordinary chat. */
export function amenityFromUtterance(text: string): AmenityKind | null {
  const t = text.toLowerCase();
  if (
    /\b(rest\s*area|rest\s*stop|service\s*area|lay[- ]?by|picnic\s*area)\b/.test(t) ||
    /استراحة|ریسٹ ایریا|रेस्ट एरिया|aire de repos|área de descanso|dinlenme tesisi/.test(t)
  ) {
    return 'rest area';
  }
  if (
    /\b(restaurant|restaurants|eatery|diner|place to eat)\b/.test(t) ||
    /مطعم|ریستوران|ریسٹورانٹ|रेस्तरां|restaurant|restoran/.test(t)
  ) {
    return 'restaurant';
  }
  return null;
}

export function nearestInRadius(
  origin: LatLng,
  places: Place[],
  radiusMeters: number,
): { place: Place; meters: number } | null {
  const ranked = places
    .map((place) => ({ place, meters: haversine(origin, place.center) }))
    .filter(({ meters }) => meters <= radiusMeters)
    .sort((a, b) => a.meters - b.meters);
  return ranked[0] ?? null;
}
