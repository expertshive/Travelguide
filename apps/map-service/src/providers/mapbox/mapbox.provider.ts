import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';
import { ProviderError } from '../errors';
import { haversineMeters, isValidLatLng, snapToRoute } from '../geo.util';
import type {
  GeocodingProvider,
  LatLng,
  MapProvider,
  ManeuverType,
  NavigationProvider,
  Place,
  Route,
  RouteLeg,
  RouteRequest,
  RouteStep,
  TrafficProvider,
  TrafficSegment,
  TravelMode,
  RoutingProvider,
} from '../types';
import { decodePolyline } from './polyline';

const API_BASE = 'https://api.mapbox.com';

/** Mapbox has no motorcycle profile; driving is the closest available match. */
const PROFILE_BY_MODE: Record<TravelMode, string> = {
  driving: 'mapbox/driving-traffic',
  motorcycle: 'mapbox/driving',
  walking: 'mapbox/walking',
  cycling: 'mapbox/cycling',
};

type MapboxFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  properties?: { category?: string };
};

type MapboxStep = {
  distance?: number;
  duration?: number;
  maneuver?: { type?: string; instruction?: string; bearing_after?: number; location?: [number, number] };
};

type MapboxLeg = { distance?: number; duration?: number; steps?: MapboxStep[]; summary?: string };

type MapboxRoute = {
  geometry?: string;
  distance?: number;
  duration?: number;
  duration_typical?: number;
  legs?: MapboxLeg[];
  weight_name?: string;
};

@Injectable()
export class MapboxProvider
  implements
    MapProvider,
    GeocodingProvider,
    RoutingProvider,
    NavigationProvider,
    TrafficProvider,
    OnModuleInit
{
  readonly name = 'mapbox';
  private readonly logger = createLogger('MapboxProvider');
  private static readonly PROVIDER = 'mapbox';

  constructor(
    private readonly config: ConfigService,
    private readonly integrations: IntegrationResolver,
  ) {}

  /** Warm the credential cache so the first request does not wait on it. */
  async onModuleInit() {
    await this.integrations.prime(MapboxProvider.PROVIDER);
  }

  /** True when a server token is configured; the registry skips this provider otherwise. */
  isConfigured() {
    return Boolean(this.integrations.peek(MapboxProvider.PROVIDER, 'MAPBOX_ACCESS_TOKEN'));
  }

  getStyleConfig() {
    return {
      styleUrl: this.config.get<string>('MAPBOX_STYLE_URL') ?? 'mapbox://styles/mapbox/streets-v12',
      // Deliberately the public (pk.*) token — the secret server token is never returned.
      publicToken: this.integrations.peek(MapboxProvider.PROVIDER, 'MAPBOX_PUBLIC_TOKEN') ?? null,
      attribution: '© Mapbox © OpenStreetMap',
    };
  }

  async search(query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const params = new URLSearchParams({
      access_token: await this.token(),
      autocomplete: 'true',
      limit: String(limit),
    });
    if (near && isValidLatLng(near)) {
      params.set('proximity', `${near.longitude},${near.latitude}`);
    }

    const url = `${API_BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
    const body = await this.request<{ features?: MapboxFeature[] }>(url, 'geocode.search');

    return (body.features ?? [])
      .map((feature) => this.toPlace(feature, near))
      .filter((place): place is Place => place !== null);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    if (!isValidLatLng(point)) {
      throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range', this.name);
    }

    const params = new URLSearchParams({ access_token: await this.token(), limit: '1' });
    const url = `${API_BASE}/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json?${params}`;
    const body = await this.request<{ features?: MapboxFeature[] }>(url, 'geocode.reverse');

    const feature = body.features?.[0];
    return feature ? this.toPlace(feature, undefined) : null;
  }

  async calculate(request: RouteRequest): Promise<Route[]> {
    const { origin, destination, waypoints, options } = request;

    for (const point of [origin, destination, ...waypoints]) {
      if (!isValidLatLng(point)) {
        throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range', this.name);
      }
    }

    const coordinates = [origin, ...waypoints, destination]
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(';');

    const params = new URLSearchParams({
      access_token: await this.token(),
      geometries: 'polyline6',
      overview: 'full',
      steps: 'true',
      alternatives: String(options.alternatives),
      language: options.language ?? 'en',
    });

    const exclusions = this.buildExclusions(request);
    if (exclusions) params.set('exclude', exclusions);

    const profile = PROFILE_BY_MODE[options.mode];
    const url = `${API_BASE}/directions/v5/${profile}/${coordinates}?${params}`;
    const body = await this.request<{ routes?: MapboxRoute[]; code?: string }>(
      url,
      'routes.calculate',
    );

    if (body.code && body.code !== 'Ok') {
      throw new ProviderError('NO_ROUTE_FOUND', `Mapbox returned ${body.code}`, this.name);
    }

    const routes = (body.routes ?? []).map((route, index) => this.toRoute(route, index, options.preference));
    if (routes.length === 0) {
      throw new ProviderError('NO_ROUTE_FOUND', 'No route between these points', this.name);
    }

    // Mapbox orders by its own weighting; honour an explicit shortest preference.
    return options.preference === 'shortest'
      ? [...routes].sort((a, b) => a.distanceMeters - b.distanceMeters)
      : routes;
  }

  snapToRoute(route: Route, position: LatLng) {
    return snapToRoute(route, position);
  }

  /**
   * Mapbox exposes congestion per geometry segment on the traffic profile.
   * The annotation is not requested here, so this reports `unknown` and exists
   * to keep the interface satisfied until congestion annotations are wired in.
   */
  async getTraffic(route: Route): Promise<TrafficSegment[]> {
    return route.geometry.slice(0, -1).map((from, index) => ({
      from,
      to: route.geometry[index + 1],
      level: 'unknown' as const,
    }));
  }

  private buildExclusions(request: RouteRequest): string | null {
    const { avoid } = request.options;
    const exclusions: string[] = [];
    if (avoid.tolls) exclusions.push('toll');
    if (avoid.highways) exclusions.push('motorway');
    if (avoid.ferries) exclusions.push('ferry');
    // Mapbox has no `unpaved` exclusion; unpaved avoidance is applied by the
    // caller's route preference instead.
    return exclusions.length ? exclusions.join(',') : null;
  }

  private toPlace(feature: MapboxFeature, near?: LatLng): Place | null {
    const center = feature.center;
    if (!center || center.length < 2) return null;

    const point: LatLng = { longitude: center[0], latitude: center[1] };
    return {
      id: `${this.name}:${feature.id ?? `${center[0]},${center[1]}`}`,
      name: feature.text ?? feature.place_name ?? 'Unknown place',
      address: feature.place_name ?? feature.text ?? '',
      center: point,
      distanceMeters: near && isValidLatLng(near) ? haversineMeters(near, point) : undefined,
      category: feature.properties?.category,
    };
  }

  private toRoute(route: MapboxRoute, index: number, preference: string): Route {
    const geometry = route.geometry ? decodePolyline(route.geometry, 6) : [];
    const legs: RouteLeg[] = (route.legs ?? []).map((leg) => ({
      distanceMeters: leg.distance ?? 0,
      durationSeconds: leg.duration ?? 0,
      steps: (leg.steps ?? []).map((step) => this.toStep(step)),
    }));

    return {
      id: `${this.name}:${index}`,
      geometry,
      distanceMeters: route.distance ?? 0,
      durationSeconds: route.duration ?? 0,
      durationInTrafficSeconds: route.duration_typical,
      legs,
      summary: index === 0 ? (preference === 'shortest' ? 'Shortest' : 'Fastest') : `Alternative ${index}`,
    };
  }

  private toStep(step: MapboxStep): RouteStep {
    const location = step.maneuver?.location;
    return {
      instruction: step.maneuver?.instruction ?? '',
      distanceMeters: step.distance ?? 0,
      durationSeconds: step.duration ?? 0,
      maneuver: this.toManeuver(step.maneuver?.type),
      bearingAfter: step.maneuver?.bearing_after ?? -1,
      location:
        location && location.length >= 2
          ? { longitude: location[0], latitude: location[1] }
          : { longitude: 0, latitude: 0 },
    };
  }

  private toManeuver(type: string | undefined): ManeuverType {
    switch (type) {
      case 'depart':
      case 'turn':
      case 'merge':
      case 'roundabout':
      case 'fork':
      case 'arrive':
        return type;
      default:
        return 'continue';
    }
  }

  /**
   * The token as configured right now, so rotating it in the admin portal takes
   * effect without a restart. The resolver caches, so this is not a network call
   * on every request.
   */
  private async token(): Promise<string> {
    const token = await this.integrations.get(MapboxProvider.PROVIDER, 'MAPBOX_ACCESS_TOKEN');
    if (!token) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Mapbox token is not configured', this.name);
    }
    return token;
  }

  /** Single place where provider HTTP faults become typed `ProviderError`s. */
  private async request<T>(url: string, operation: string): Promise<T> {
    const timeoutMs = Number(this.config.get<string>('MAPBOX_TIMEOUT_MS') ?? 8000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (response.status === 429) {
        throw new ProviderError('PROVIDER_RATE_LIMITED', 'Mapbox rate limit reached', this.name);
      }
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError('PROVIDER_UNAVAILABLE', 'Mapbox rejected the token', this.name);
      }
      if (!response.ok) {
        throw new ProviderError(
          'PROVIDER_UNAVAILABLE',
          `Mapbox responded ${response.status}`,
          this.name,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('Mapbox timed out', { operation, timeoutMs });
        throw new ProviderError('PROVIDER_TIMEOUT', 'Mapbox request timed out', this.name);
      }
      this.logger.error('Mapbox request failed', {
        operation,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Mapbox request failed', this.name);
    } finally {
      clearTimeout(timer);
    }
  }
}
