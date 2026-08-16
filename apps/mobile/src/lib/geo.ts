import type { LatLng, SavedPlace } from './map';

/** Human distance: metres under 1 km, otherwise km with one decimal. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** Human duration: minutes, or hours + minutes past 60. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Route origin is GPS only. Never a default city (Riyadh) or a saved Home pin.
 */
export function originFrom(me: LatLng | null, _savedPlaces?: SavedPlace[]): LatLng | null {
  return me;
}

export function savedPlaceToLatLng(place: SavedPlace): LatLng {
  return { latitude: place.latitude, longitude: place.longitude };
}

/** Camera delta that frames a circle of `meters` around a point. */
export function regionForRadius(
  center: LatLng,
  meters: number,
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } {
  const latDelta = Math.max((meters / 111_000) * 2.6, 0.012);
  const cos = Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.25);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: latDelta,
    longitudeDelta: latDelta / cos,
  };
}
