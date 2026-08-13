import { mockConfig } from '../testing/config.mock';
import { mockIntegrations } from '../testing/integrations.mock';
import { GoogleProvider } from '../providers/google/google.provider';
import { MapboxProvider } from '../providers/mapbox/mapbox.provider';
import { OfflineProvider } from '../providers/offline/offline.provider';
import { ProviderRegistry } from '../providers/provider.registry';
import { CacheService } from '../redis/cache.service';
import type { UsageService } from '../usage/usage.service';
import type { CalculateRouteDto } from './dto/routes.dto';
import { RoutesService } from './routes.service';

const USER = 'user-1';
const ORIGIN = { latitude: 24.7136, longitude: 46.6753 };
const DESTINATION = { latitude: 24.7743, longitude: 46.7386 };

const dto = (overrides: Partial<CalculateRouteDto> = {}): CalculateRouteDto => ({
  origin: ORIGIN,
  destination: DESTINATION,
  ...overrides,
});

type Harness = {
  service: RoutesService;
  offline: OfflineProvider;
  usage: { track: jest.Mock };
};

const buildHarness = (env: Record<string, string> = {}): Harness => {
  // No REDIS_URL, so CacheService uses its in-process fallback.
  const config = mockConfig({ MAP_PROVIDER: 'offline', ...env });
  const cache = new CacheService(config);
  cache.onModuleInit();

  const offline = new OfflineProvider();
  // No credentials, so both real providers stay out of the chain and these tests
  // exercise the offline provider deterministically.
  const integrations = mockIntegrations();
  const registry = new ProviderRegistry(
    config,
    new GoogleProvider(config, integrations),
    new MapboxProvider(config, integrations),
    offline,
  );
  const usage = { track: jest.fn() };

  return {
    service: new RoutesService(registry, cache, usage as unknown as UsageService, config),
    offline,
    usage,
  };
};

describe('RoutesService', () => {
  describe('calculate', () => {
    it('returns a route between two points', async () => {
      const { service } = buildHarness();
      const routes = await service.calculate(USER, dto());

      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].distanceMeters).toBeGreaterThan(0);
    });

    it('serves a repeat request from cache instead of calling the provider again', async () => {
      const { service, offline, usage } = buildHarness();
      const calculate = jest.spyOn(offline, 'calculate');

      await service.calculate(USER, dto());
      await service.calculate(USER, dto());

      expect(calculate).toHaveBeenCalledTimes(1);
      expect(usage.track).toHaveBeenCalledWith('offline', 'routes.calculate', 'cacheHit');
    });

    it('treats a different travel mode as a separate cache entry', async () => {
      const { service, offline } = buildHarness();
      const calculate = jest.spyOn(offline, 'calculate');

      await service.calculate(USER, dto());
      await service.calculate(USER, dto({ mode: 'walking' }));

      expect(calculate).toHaveBeenCalledTimes(2);
    });

    it('rejects a trip whose origin and destination are the same', async () => {
      const { service } = buildHarness();

      await expect(
        service.calculate(USER, dto({ destination: ORIGIN })),
      ).rejects.toMatchObject({ code: 'INVALID_LOCATION' });
    });

    it('rate limits a user who asks for too many routes', async () => {
      const { service } = buildHarness({ MAP_RATE_LIMIT_PER_MINUTE: '2' });

      // Distinct destinations so each call misses the cache.
      await service.calculate(USER, dto());
      await service.calculate(USER, dto({ destination: { latitude: 24.8, longitude: 46.8 } }));

      await expect(
        service.calculate(USER, dto({ destination: { latitude: 24.9, longitude: 46.9 } })),
      ).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    });

    it('applies the rate limit per user rather than globally', async () => {
      const { service } = buildHarness({ MAP_RATE_LIMIT_PER_MINUTE: '1' });

      await service.calculate(USER, dto());
      await expect(service.calculate('user-2', dto({ mode: 'cycling' }))).resolves.toBeDefined();
    });
  });

  describe('alternatives', () => {
    it('returns more than one option', async () => {
      const { service } = buildHarness();
      const routes = await service.alternatives(USER, dto());

      expect(routes.length).toBeGreaterThan(1);
      expect(routes[0].id).not.toBe(routes[1].id);
    });
  });

  describe('reroute', () => {
    it('does not call the provider while the traveller is still on the route', async () => {
      const { service, offline } = buildHarness();
      const [route] = await service.calculate(USER, dto());
      const onRoute = route.geometry[3];

      const calculate = jest.spyOn(offline, 'calculate');
      const result = await service.reroute(USER, { ...dto(), currentPosition: onRoute });

      expect(result.rerouted).toBe(false);
      expect(result.offRouteMeters).toBeLessThan(50);
      expect(calculate).not.toHaveBeenCalled();
    });

    it('recalculates from the traveller position once they leave the route', async () => {
      const { service } = buildHarness();
      await service.calculate(USER, dto());

      // Roughly 5 km away from the line.
      const offRoute = { latitude: 24.76, longitude: 46.62 };
      const result = await service.reroute(USER, { ...dto(), currentPosition: offRoute });

      expect(result.rerouted).toBe(true);
      expect(result.offRouteMeters).toBeGreaterThan(50);
      expect(result.routes[0].geometry[0]).toEqual(offRoute);
    });

    it('honours a widened off-route threshold', async () => {
      const { service } = buildHarness({ OFF_ROUTE_THRESHOLD_METERS: '20000' });
      await service.calculate(USER, dto());

      const result = await service.reroute(USER, {
        ...dto(),
        currentPosition: { latitude: 24.76, longitude: 46.62 },
      });

      expect(result.rerouted).toBe(false);
    });

    it('suppresses a second reroute inside the cooldown window', async () => {
      const { service } = buildHarness({ REROUTE_COOLDOWN_SECONDS: '600' });
      await service.calculate(USER, dto());

      const offRoute = { latitude: 24.76, longitude: 46.62 };
      const first = await service.reroute(USER, { ...dto(), currentPosition: offRoute });
      const second = await service.reroute(USER, {
        ...dto(),
        currentPosition: { latitude: 24.762, longitude: 46.618 },
      });

      expect(first.rerouted).toBe(true);
      expect(second.rerouted).toBe(false);
    });
  });

  describe('estimateStopImpact', () => {
    it('reports the extra time and distance a detour costs', async () => {
      const { service } = buildHarness();

      const impact = await service.estimateStopImpact(USER, {
        ...dto(),
        candidateStop: { latitude: 24.8, longitude: 46.62 },
      });

      expect(impact.addedDistanceMeters).toBeGreaterThan(0);
      expect(impact.addedDurationSeconds).toBeGreaterThan(0);
      expect(impact.detourFromRouteMeters).toBeGreaterThan(0);
      expect(impact.withStop.distanceMeters).toBeGreaterThan(impact.baseline.distanceMeters);
    });

    it('reports a near-zero detour for a stop already on the route', async () => {
      const { service } = buildHarness();
      const [route] = await service.calculate(USER, dto());

      const impact = await service.estimateStopImpact(USER, {
        ...dto(),
        candidateStop: route.geometry[5],
      });

      expect(impact.detourFromRouteMeters).toBeLessThan(50);
    });
  });
});
