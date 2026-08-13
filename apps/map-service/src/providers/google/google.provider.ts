import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';
import { ProviderError } from '../errors';
import { haversineMeters, isValidLatLng, snapToRoute } from '../geo.util';
import { decodePolyline } from '../mapbox/polyline';
import type {
  GeocodingProvider,
  LatLng,
  ManeuverType,
  MapProvider,
  NavigationProvider,
  Place,
  Route,
  RouteLeg,
  RouteRequest,
  RouteStep,
  RoutingProvider,
  TrafficProvider,
  TrafficSegment,
  TravelMode,
} from '../types';

const API_BASE = 'https://maps.googleapis.com/maps/api';

/** Google has no motorcycle profile; driving is the closest match. Cycling → bicycling. */
const MODE_BY_TRAVEL: Record<TravelMode, string> = {
  driving: 'driving',
  motorcycle: 'driving',
  walking: 'walking',
  cycling: 'bicycling',
};

type LatLngLiteral = { lat: number; lng: number };

type GooglePlace = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: LatLngLiteral };
  types?: string[];
};

type GoogleStep = {
  html_instructions?: string;
  distance?: { value?: number };
  duration?: { value?: number };
  start_location?: LatLngLiteral;
  maneuver?: string;
};

type GoogleLeg = {
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
  steps?: GoogleStep[];
};

type GoogleRoute = {
  overview_polyline?: { points?: string };
  legs?: GoogleLeg[];
  summary?: string;
};

/**
 * Google Maps Platform provider. The mobile app renders Google tiles natively
 * via the Maps SDK key, while search / routing / directions come through here so
 * the server key is never shipped to clients.
 *
 * Requires these APIs enabled on the key: Places API, Directions API, Geocoding API.
 */
@Injectable()
export class GoogleProvider
  implements
    MapProvider,
    GeocodingProvider,
    RoutingProvider,
    NavigationProvider,
    TrafficProvider,
    OnModuleInit
{
  readonly name = 'google';
  private readonly logger = createLogger('GoogleProvider');
  private static readonly PROVIDER = 'google_maps';

  constructor(
    private readonly config: ConfigService,
    private readonly integrations: IntegrationResolver,
  ) {}

  /** Warm the credential cache so the first request does not wait on it. */
  async onModuleInit() {
    await this.integrations.prime(GoogleProvider.PROVIDER);
  }

  /** The registry skips this provider unless a server key is configured. */
  isConfigured() {
    return Boolean(this.integrations.peek(GoogleProvider.PROVIDER, 'GOOGLE_MAPS_API_KEY'));
  }

  getStyleConfig() {
    // Google Maps renders natively on the client via the Maps SDK key; there is
    // no style URL or public token to hand out here.
    return { styleUrl: '', publicToken: null, attribution: '© Google' };
  }

  async search(query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const params = new URLSearchParams({ query, key: await this.key() });
    if (near && isValidLatLng(near)) {
      params.set('location', `${near.latitude},${near.longitude}`);
      params.set('radius', '50000');
    }

    const body = await this.request<{ status?: string; results?: GooglePlace[] }>(
      `${API_BASE}/place/textsearch/json?${params}`,
      'geocode.search',
    );
    this.assertStatus(body.status, 'geocode.search', { allowZeroResults: true });

    return (body.results ?? [])
      .slice(0, limit)
      .map((place) => this.toPlace(place, near))
      .filter((place): place is Place => place !== null);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    if (!isValidLatLng(point)) {
      throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range', this.name);
    }
    const params = new URLSearchParams({
      latlng: `${point.latitude},${point.longitude}`,
      key: await this.key(),
    });
    const body = await this.request<{ status?: string; results?: GooglePlace[] }>(
      `${API_BASE}/geocode/json?${params}`,
      'geocode.reverse',
    );
    this.assertStatus(body.status, 'geocode.reverse', { allowZeroResults: true });

    const first = body.results?.[0];
    return first ? this.toPlace(first, undefined) : null;
  }

  async calculate(request: RouteRequest): Promise<Route[]> {
    const { origin, destination, waypoints, options } = request;
    for (const point of [origin, destination, ...waypoints]) {
      if (!isValidLatLng(point)) {
        throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range', this.name);
      }
    }

    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      mode: MODE_BY_TRAVEL[options.mode],
      alternatives: String(options.alternatives),
      language: options.language ?? 'en',
      key: await this.key(),
    });
    if (waypoints.length) {
      params.set('waypoints', waypoints.map((p) => `${p.latitude},${p.longitude}`).join('|'));
    }
    const avoid = this.buildAvoid(request);
    if (avoid) params.set('avoid', avoid);
    // Traffic-aware duration is only available for driving with a departure time.
    if (MODE_BY_TRAVEL[options.mode] === 'driving') params.set('departure_time', 'now');

    const body = await this.request<{ status?: string; routes?: GoogleRoute[] }>(
      `${API_BASE}/directions/json?${params}`,
      'routes.calculate',
    );
    this.assertStatus(body.status, 'routes.calculate', { zeroResultsMeans: 'NO_ROUTE_FOUND' });

    const routes = (body.routes ?? []).map((route, index) =>
      this.toRoute(route, index, options.preference),
    );
    if (routes.length === 0) {
      throw new ProviderError('NO_ROUTE_FOUND', 'No route between these points', this.name);
    }
    return options.preference === 'shortest'
      ? [...routes].sort((a, b) => a.distanceMeters - b.distanceMeters)
      : routes;
  }

  snapToRoute(route: Route, position: LatLng) {
    return snapToRoute(route, position);
  }

  async getTraffic(route: Route): Promise<TrafficSegment[]> {
    return route.geometry.slice(0, -1).map((from, index) => ({
      from,
      to: route.geometry[index + 1],
      level: 'unknown' as const,
    }));
  }

  // -- mapping ---------------------------------------------------------------

  private buildAvoid(request: RouteRequest): string | null {
    const { avoid } = request.options;
    const parts: string[] = [];
    if (avoid.tolls) parts.push('tolls');
    if (avoid.highways) parts.push('highways');
    if (avoid.ferries) parts.push('ferries');
    return parts.length ? parts.join('|') : null;
  }

  private toPlace(place: GooglePlace, near?: LatLng): Place | null {
    const loc = place.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
    const center: LatLng = { latitude: loc.lat, longitude: loc.lng };
    return {
      id: `${this.name}:${place.place_id ?? `${loc.lat},${loc.lng}`}`,
      name: place.name ?? place.formatted_address ?? 'Unknown place',
      address: place.formatted_address ?? place.name ?? '',
      center,
      distanceMeters: near && isValidLatLng(near) ? haversineMeters(near, center) : undefined,
      category: place.types?.[0],
    };
  }

  private toRoute(route: GoogleRoute, index: number, preference: string): Route {
    const geometry = route.overview_polyline?.points
      ? decodePolyline(route.overview_polyline.points, 5)
      : [];
    const legs: RouteLeg[] = (route.legs ?? []).map((leg) => ({
      distanceMeters: leg.distance?.value ?? 0,
      durationSeconds: leg.duration?.value ?? 0,
      steps: (leg.steps ?? []).map((step) => this.toStep(step)),
    }));
    const distanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
    const durationSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
    const trafficSeconds = (route.legs ?? []).reduce(
      (sum, leg) => sum + (leg.duration_in_traffic?.value ?? 0),
      0,
    );

    return {
      id: `${this.name}:${index}`,
      geometry,
      distanceMeters,
      durationSeconds,
      durationInTrafficSeconds: trafficSeconds || undefined,
      legs,
      summary:
        route.summary ||
        (index === 0 ? (preference === 'shortest' ? 'Shortest' : 'Fastest') : `Alternative ${index}`),
    };
  }

  private toStep(step: GoogleStep): RouteStep {
    const loc = step.start_location;
    return {
      instruction: this.stripHtml(step.html_instructions ?? ''),
      distanceMeters: step.distance?.value ?? 0,
      durationSeconds: step.duration?.value ?? 0,
      maneuver: this.toManeuver(step.maneuver),
      bearingAfter: -1,
      location:
        loc && typeof loc.lat === 'number'
          ? { latitude: loc.lat, longitude: loc.lng }
          : { latitude: 0, longitude: 0 },
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toManeuver(type: string | undefined): ManeuverType {
    if (!type) return 'continue';
    if (type.includes('roundabout')) return 'roundabout';
    if (type.includes('merge')) return 'merge';
    if (type.includes('fork')) return 'fork';
    if (type.includes('turn')) return 'turn';
    if (type === 'straight') return 'continue';
    return 'continue';
  }

  /**
   * The key as configured right now. Read per request so rotating it in the
   * admin portal takes effect without restarting the service; the resolver
   * caches, so this is not a network call each time.
   */
  private async key(): Promise<string> {
    const key = await this.integrations.get(GoogleProvider.PROVIDER, 'GOOGLE_MAPS_API_KEY');
    if (!key) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'No Google Maps API key is configured', this.name);
    }
    return key;
  }

  /** Google returns HTTP 200 with a `status` field; this maps that to typed errors. */
  private assertStatus(
    status: string | undefined,
    operation: string,
    opts: { allowZeroResults?: boolean; zeroResultsMeans?: 'NO_ROUTE_FOUND' } = {},
  ): void {
    if (status === 'OK') return;
    if (status === 'ZERO_RESULTS') {
      if (opts.zeroResultsMeans === 'NO_ROUTE_FOUND') {
        throw new ProviderError('NO_ROUTE_FOUND', 'No route between these points', this.name);
      }
      if (opts.allowZeroResults) return;
    }
    if (status === 'OVER_QUERY_LIMIT') {
      throw new ProviderError('PROVIDER_RATE_LIMITED', 'Google rate limit reached', this.name);
    }
    if (status === 'REQUEST_DENIED') {
      throw new ProviderError(
        'PROVIDER_UNAVAILABLE',
        'Google rejected the request (check API is enabled and key is valid)',
        this.name,
      );
    }
    throw new ProviderError('PROVIDER_UNAVAILABLE', `Google returned ${status} for ${operation}`, this.name);
  }

  private async request<T>(url: string, operation: string): Promise<T> {
    const timeoutMs = Number(this.config.get<string>('MAP_TIMEOUT_MS') ?? 8000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 429) {
        throw new ProviderError('PROVIDER_RATE_LIMITED', 'Google rate limit reached', this.name);
      }
      if (!response.ok) {
        throw new ProviderError('PROVIDER_UNAVAILABLE', `Google responded ${response.status}`, this.name);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('Google timed out', { operation, timeoutMs });
        throw new ProviderError('PROVIDER_TIMEOUT', 'Google request timed out', this.name);
      }
      this.logger.error('Google request failed', {
        operation,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Google request failed', this.name);
    } finally {
      clearTimeout(timer);
    }
  }
}
