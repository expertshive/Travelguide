import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@traveler-guide/logger';
import { ProviderError } from '../providers/errors';
import { haversineMeters } from '../providers/geo.util';
import { ProviderRegistry } from '../providers/provider.registry';
import { DEFAULT_AVOID, type LatLng, type Route, type RouteOptions, type RouteRequest } from '../providers/types';
import { CacheService } from '../redis/cache.service';
import { UsageService } from '../usage/usage.service';
import type { CalculateRouteDto, EstimateStopImpactDto, RerouteDto } from './dto/routes.dto';

const ROUTE_TTL_SECONDS = 60 * 5;

/**
 * How far off the line the traveller must be before we accept that they left
 * the route. Generous enough to absorb GPS drift and multi-lane roads.
 */
const DEFAULT_OFF_ROUTE_THRESHOLD_METERS = 50;

@Injectable()
export class RoutesService {
  private readonly logger = createLogger('RoutesService');

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly cache: CacheService,
    private readonly usage: UsageService,
    private readonly config: ConfigService,
  ) {}

  async calculate(userId: string, dto: CalculateRouteDto): Promise<Route[]> {
    return this.resolve(userId, this.toRequest(dto));
  }

  async alternatives(userId: string, dto: CalculateRouteDto): Promise<Route[]> {
    const request = this.toRequest(dto);
    request.options.alternatives = true;
    return this.resolve(userId, request);
  }

  /**
   * Recalculate from where the traveller actually is.
   *
   * Returns `rerouted: false` without calling a provider when they are still on
   * the line — this is the guard that stops a drifting GPS signal from firing a
   * provider request on every location update.
   */
  async reroute(
    userId: string,
    dto: RerouteDto,
  ): Promise<{ rerouted: boolean; offRouteMeters: number; routes: Route[] }> {
    const request = this.toRequest(dto);
    const current: LatLng = dto.currentPosition;
    const threshold = Number(
      this.config.get<string>('OFF_ROUTE_THRESHOLD_METERS') ?? DEFAULT_OFF_ROUTE_THRESHOLD_METERS,
    );

    const cachedRoutes = await this.cache.get<Route[]>(this.routeKey(request));
    if (cachedRoutes?.length) {
      const { distanceMeters } = this.registry.primary().snapToRoute(cachedRoutes[0], current);
      if (distanceMeters <= threshold) {
        return { rerouted: false, offRouteMeters: distanceMeters, routes: cachedRoutes };
      }
    }

    // Debounce: one reroute per traveller per window, regardless of GPS noise.
    const cooldown = Number(this.config.get<string>('REROUTE_COOLDOWN_SECONDS') ?? 15);
    const { allowed } = await this.cache.consumeRateLimit(`reroute:${userId}`, 1, cooldown);
    if (!allowed && cachedRoutes?.length) {
      this.logger.info('Reroute suppressed by cooldown', { userId });
      return { rerouted: false, offRouteMeters: threshold, routes: cachedRoutes };
    }

    const fromCurrent: RouteRequest = { ...request, origin: current };
    const routes = await this.resolve(userId, fromCurrent, { skipCache: true });

    return {
      rerouted: true,
      offRouteMeters: cachedRoutes?.length
        ? this.registry.primary().snapToRoute(cachedRoutes[0], current).distanceMeters
        : 0,
      routes,
    };
  }

  /**
   * How much longer the trip becomes if a candidate stop is inserted.
   * Compares the current best route against the best route through the stop.
   */
  async estimateStopImpact(userId: string, dto: EstimateStopImpactDto) {
    const baseRequest = this.toRequest(dto);
    const [baseline] = await this.resolve(userId, baseRequest);

    const withStop = this.toRequest(dto);
    withStop.waypoints = [...withStop.waypoints, dto.candidateStop];
    const [candidate] = await this.resolve(userId, withStop);

    return {
      baseline: this.summarise(baseline),
      withStop: this.summarise(candidate),
      addedDistanceMeters: candidate.distanceMeters - baseline.distanceMeters,
      addedDurationSeconds: candidate.durationSeconds - baseline.durationSeconds,
      detourFromRouteMeters: this.registry
        .primary()
        .snapToRoute(baseline, dto.candidateStop).distanceMeters,
    };
  }

  private summarise(route: Route) {
    return {
      id: route.id,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      summary: route.summary,
    };
  }

  private async resolve(
    userId: string,
    request: RouteRequest,
    opts: { skipCache?: boolean } = {},
  ): Promise<Route[]> {
    if (haversineMeters(request.origin, request.destination) < 1) {
      throw new ProviderError('INVALID_LOCATION', 'Origin and destination are the same place');
    }

    const key = this.routeKey(request);
    if (!opts.skipCache) {
      const cached = await this.cache.get<Route[]>(key);
      if (cached) {
        this.usage.track(this.registry.primary().name, 'routes.calculate', 'cacheHit');
        return cached;
      }
    }

    await this.enforceRateLimit(userId);

    let outcome: { result: Route[]; provider: string };
    try {
      outcome = await this.registry.run('routes.calculate', (p) => p.calculate(request));
    } catch (error) {
      this.usage.track(this.registry.primary().name, 'routes.calculate', 'error');
      throw error;
    }

    this.usage.track(outcome.provider, 'routes.calculate', 'request');
    await this.cache.set(key, outcome.result, ROUTE_TTL_SECONDS);
    return outcome.result;
  }

  private toRequest(dto: CalculateRouteDto): RouteRequest {
    const options: RouteOptions = {
      mode: dto.mode ?? 'driving',
      preference: dto.preference ?? 'fastest',
      avoid: { ...DEFAULT_AVOID, ...(dto.avoid ?? {}) },
      alternatives: dto.alternatives ?? false,
      language: dto.language ?? 'en',
    };

    return {
      origin: { latitude: dto.origin.latitude, longitude: dto.origin.longitude },
      destination: { latitude: dto.destination.latitude, longitude: dto.destination.longitude },
      waypoints: (dto.waypoints ?? []).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      options,
    };
  }

  private async enforceRateLimit(userId: string) {
    const limit = Number(this.config.get<string>('MAP_RATE_LIMIT_PER_MINUTE') ?? 60);
    const { allowed } = await this.cache.consumeRateLimit(`routes:${userId}`, limit, 60);
    if (!allowed) {
      throw new ProviderError('PROVIDER_RATE_LIMITED', 'Too many route requests, slow down');
    }
  }

  /** Coordinates are rounded to ~11 m so tiny GPS jitter still hits the cache. */
  private routeKey(request: RouteRequest) {
    const point = (p: LatLng) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
    const { options } = request;
    const avoid = Object.entries(options.avoid)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join('+') || 'none';

    return [
      'routes',
      point(request.origin),
      request.waypoints.map(point).join('|') || 'direct',
      point(request.destination),
      options.mode,
      options.preference,
      avoid,
      options.alternatives ? 'alt' : 'single',
    ].join(':');
  }
}
