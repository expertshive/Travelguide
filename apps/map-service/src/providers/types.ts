/** Provider-neutral map domain types. Nothing Mapbox-specific may leak in here. */

export const TRAVEL_MODES = ['driving', 'motorcycle', 'walking', 'cycling'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const ROUTE_PREFERENCES = ['fastest', 'shortest'] as const;
export type RoutePreference = (typeof ROUTE_PREFERENCES)[number];

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Place = {
  /** Provider-scoped identifier, prefixed with the provider name. */
  id: string;
  name: string;
  address: string;
  center: LatLng;
  /** Straight-line metres from the search origin, when one was supplied. */
  distanceMeters?: number;
  category?: string;
};

export type RouteAvoidOptions = {
  tolls: boolean;
  highways: boolean;
  unpaved: boolean;
  ferries: boolean;
};

export type RouteOptions = {
  mode: TravelMode;
  preference: RoutePreference;
  avoid: RouteAvoidOptions;
  /** Ask the provider for more than one candidate route. */
  alternatives: boolean;
  language?: string;
};

export type ManeuverType =
  | 'depart'
  | 'turn'
  | 'merge'
  | 'roundabout'
  | 'fork'
  | 'continue'
  | 'arrive';

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: ManeuverType;
  /** Degrees clockwise from north; negative when the provider omits it. */
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
  /** Decoded polyline, ordered from origin to destination. */
  geometry: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  /** Duration including live traffic when the provider supplies it. */
  durationInTrafficSeconds?: number;
  legs: RouteLeg[];
  /** Short human label such as "Fastest" or "Avoids tolls". */
  summary: string;
};

export type RouteRequest = {
  origin: LatLng;
  destination: LatLng;
  /** Ordered intermediate stops. */
  waypoints: LatLng[];
  options: RouteOptions;
};

export type TrafficLevel = 'unknown' | 'free' | 'light' | 'moderate' | 'heavy';

export type TrafficSegment = {
  from: LatLng;
  to: LatLng;
  level: TrafficLevel;
};

/** Renders map tiles/styles on the client. The server only hands out config. */
export interface MapProvider {
  readonly name: string;
  getStyleConfig(): { styleUrl: string; publicToken: string | null; attribution: string };
}

export interface GeocodingProvider {
  readonly name: string;
  search(query: string, near?: LatLng, limit?: number): Promise<Place[]>;
  reverse(point: LatLng): Promise<Place | null>;
}

export interface RoutingProvider {
  readonly name: string;
  calculate(request: RouteRequest): Promise<Route[]>;
}

/** Turn-by-turn concerns: progress along a route and off-route detection. */
export interface NavigationProvider {
  readonly name: string;
  snapToRoute(route: Route, position: LatLng): { index: number; distanceMeters: number };
}

export interface TrafficProvider {
  readonly name: string;
  getTraffic(route: Route): Promise<TrafficSegment[]>;
}

export const DEFAULT_AVOID: RouteAvoidOptions = {
  tolls: false,
  highways: false,
  unpaved: false,
  ferries: false,
};
