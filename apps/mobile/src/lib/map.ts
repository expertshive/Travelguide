import { authorizedRequest } from './auth';

/* -------------------------------------------------------------------------- */
/* Types (mirror map-service provider-neutral shapes)                          */
/* -------------------------------------------------------------------------- */

export type LatLng = { latitude: number; longitude: number };

export type Place = {
  id: string;
  name: string;
  address: string;
  center: LatLng;
  distanceMeters?: number;
  category?: string;
};

export type PlaceLabel = 'HOME' | 'WORK' | 'CUSTOM';

export type SavedPlace = {
  id: string;
  userId: string;
  label: PlaceLabel;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
};

export type RecentSearch = {
  id: string;
  userId: string;
  query: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  searchedAt: string;
};

export type MapConfig = {
  provider: string;
  styleUrl: string;
  publicToken: string | null;
  attribution: string;
};

export const TRAVEL_MODES = ['driving', 'motorcycle', 'walking', 'cycling'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export type RoutePreference = 'fastest' | 'shortest';

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: string;
  bearingAfter: number;
  location: LatLng;
};

export type RouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
};

export type Route = {
  id: string;
  geometry: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds?: number;
  legs: RouteLeg[];
  summary: string;
};

export type SavePlaceInput = {
  label: PlaceLabel;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type RouteAvoid = {
  tolls?: boolean;
  highways?: boolean;
  ferries?: boolean;
  unpaved?: boolean;
};

export type RouteRequestInput = {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
  mode?: TravelMode;
  preference?: RoutePreference;
  avoid?: RouteAvoid;
  alternatives?: boolean;
  language?: string;
};

/* -------------------------------------------------------------------------- */
/* Geocoding                                                                   */
/* -------------------------------------------------------------------------- */

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function getMapConfig(): Promise<MapConfig> {
  return authorizedRequest<MapConfig>('/map/geocode/config');
}

export function searchPlaces(q: string, near?: LatLng, limit = 8): Promise<Place[]> {
  return authorizedRequest<Place[]>(
    `/map/geocode/search${qs({ q, latitude: near?.latitude, longitude: near?.longitude, limit })}`,
  );
}

export function reverseGeocode(point: LatLng): Promise<Place | null> {
  return authorizedRequest<Place | null>(
    `/map/geocode/reverse${qs({ latitude: point.latitude, longitude: point.longitude })}`,
  );
}

export function listRecentSearches(): Promise<RecentSearch[]> {
  return authorizedRequest<RecentSearch[]>('/map/geocode/recent');
}

export function clearRecentSearches(): Promise<{ count: number }> {
  return authorizedRequest<{ count: number }>('/map/geocode/recent', { method: 'DELETE' });
}

/* -------------------------------------------------------------------------- */
/* Saved places                                                                */
/* -------------------------------------------------------------------------- */

export function listSavedPlaces(): Promise<SavedPlace[]> {
  return authorizedRequest<SavedPlace[]>('/map/geocode/places');
}

export function savePlace(input: SavePlaceInput): Promise<SavedPlace[]> {
  return authorizedRequest<SavedPlace[]>('/map/geocode/places', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteSavedPlace(id: string): Promise<SavedPlace[]> {
  return authorizedRequest<SavedPlace[]>(`/map/geocode/places/${id}`, { method: 'DELETE' });
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

export function calculateRoute(input: RouteRequestInput): Promise<Route[]> {
  return authorizedRequest<Route[]>('/map/routes/calculate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function routeAlternatives(input: RouteRequestInput): Promise<Route[]> {
  return authorizedRequest<Route[]>('/map/routes/alternatives', {
    method: 'POST',
    body: JSON.stringify({ ...input, alternatives: true }),
  });
}
