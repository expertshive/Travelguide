import type { LatLng, SavedPlace } from './map';

/**
 * A sensible default "here" for the demo: central Riyadh. The app has no native
 * geolocation module wired yet, so searches bias around this point and route
 * previews use the traveller's saved Home when available, falling back here.
 */
export const DEFAULT_LOCATION: LatLng = { latitude: 24.7136, longitude: 46.6753 };

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

/** The origin to plan a route from: saved Home if present, else the default. */
export function originFrom(savedPlaces: SavedPlace[]): LatLng {
  const home = savedPlaces.find((p) => p.label === 'HOME');
  if (home) return { latitude: home.latitude, longitude: home.longitude };
  return DEFAULT_LOCATION;
}

export function savedPlaceToLatLng(place: SavedPlace): LatLng {
  return { latitude: place.latitude, longitude: place.longitude };
}
