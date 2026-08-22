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

export function amenitySearchQuery(kind: AmenityKind): string {
  return kind === 'rest area' ? 'rest area' : 'restaurant';
}

function cleanDestQuery(value: string): string {
  return value
    .replace(/^(to|the|a|an)\s+/i, '')
    .replace(/\s+(please|now|thanks|thank you)$/i, '')
    .replace(/["']/g, '')
    .trim();
}

/**
 * “Take me to Liberty Market”, “set destination to the airport”, etc.
 * Returns the place query, or null when this is ordinary chat / an amenity stop.
 */
export function destinationFromUtterance(text: string): string | null {
  if (amenityFromUtterance(text)) return null;
  const raw = text.trim().replace(/[.?!]+$/g, '');
  if (raw.length < 3) return null;

  const patterns: RegExp[] = [
    /^(?:please\s+)?(?:take me|drive me|drop me|get me)\s+(?:to|towards)\s+(.+)$/i,
    /^(?:please\s+)?(?:go|drive|navigate|head|route)\s+to\s+(.+)$/i,
    /^(?:please\s+)?(?:give me\s+)?directions?\s+to\s+(.+)$/i,
    /^(?:please\s+)?(?:set|change|update)\s+(?:the\s+)?(?:destination|end)\s+(?:to|as)\s+(.+)$/i,
    /^(?:my\s+)?destination\s+(?:is|to)\s+(.+)$/i,
    /^(?:i\s+(?:want|wanna|need|have)\s+to\s+go\s+to)\s+(.+)$/i,
    /^(?:i'?m\s+going\s+to|let'?s\s+go\s+(?:to\s+)?)\s*(.+)$/i,
    /^(?:mujhe|mujhko)\s+(.+?)\s+(?:le\s*(?:ke\s+)?chalo|le\s*jao|le\s*jaana|jana\s*hai)$/i,
    /^(.+?)\s+(?:le\s*chalo|jana\s*hai)\s*$/i,
    /^(?:خذني|وصلني)\s+(?:إلى\s+)?(.+)$/i,
  ];

  for (const re of patterns) {
    const match = raw.match(re);
    const query = match?.[1] ? cleanDestQuery(match[1]) : '';
    if (query.length >= 2 && !/^(there|home|here)$/i.test(query)) return query;
  }
  return null;
}
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
