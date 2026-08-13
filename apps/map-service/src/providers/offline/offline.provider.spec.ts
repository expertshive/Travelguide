import { haversineMeters } from '../geo.util';
import { DEFAULT_AVOID, type RouteRequest } from '../types';
import { OfflineProvider } from './offline.provider';

const ORIGIN = { latitude: 24.7136, longitude: 46.6753 };
const DESTINATION = { latitude: 24.7743, longitude: 46.7386 };

const request = (overrides: Partial<RouteRequest> = {}): RouteRequest => ({
  origin: ORIGIN,
  destination: DESTINATION,
  waypoints: [],
  options: {
    mode: 'driving',
    preference: 'fastest',
    avoid: { ...DEFAULT_AVOID },
    alternatives: false,
  },
  ...overrides,
});

describe('OfflineProvider', () => {
  const provider = new OfflineProvider();

  describe('search', () => {
    it('returns results near the supplied position', async () => {
      const places = await provider.search('cafe', ORIGIN);

      expect(places.length).toBeGreaterThan(0);
      for (const place of places) {
        expect(haversineMeters(ORIGIN, place.center)).toBeLessThan(10_000);
      }
    });

    it('returns nothing for a blank query', async () => {
      expect(await provider.search('   ')).toEqual([]);
    });

    it('respects the requested limit', async () => {
      expect(await provider.search('cafe', ORIGIN, 2)).toHaveLength(2);
    });
  });

  describe('reverse', () => {
    it('describes a dropped pin', async () => {
      const place = await provider.reverse(ORIGIN);
      expect(place?.center).toEqual(ORIGIN);
    });

    it('rejects an out-of-range point', async () => {
      await expect(provider.reverse({ latitude: 95, longitude: 0 })).rejects.toMatchObject({
        code: 'INVALID_LOCATION',
      });
    });
  });

  describe('calculate', () => {
    it('produces a single route that starts at the origin and ends at the destination', async () => {
      const [route] = await provider.calculate(request());

      expect(route.geometry[0]).toEqual(ORIGIN);
      expect(route.geometry[route.geometry.length - 1]).toEqual(DESTINATION);
      expect(route.distanceMeters).toBeGreaterThan(0);
      expect(route.durationSeconds).toBeGreaterThan(0);
    });

    it('ends the step list with an arrival instruction', async () => {
      const [route] = await provider.calculate(request());
      const steps = route.legs[0].steps;

      expect(steps[0].maneuver).toBe('depart');
      expect(steps[steps.length - 1].maneuver).toBe('arrive');
    });

    it('offers a distinct alternative when asked', async () => {
      const req = request();
      req.options.alternatives = true;

      const routes = await provider.calculate(req);

      expect(routes).toHaveLength(2);
      expect(routes[1].distanceMeters).toBeGreaterThan(routes[0].distanceMeters);
    });

    it('routes through waypoints in order', async () => {
      const stop = { latitude: 24.74, longitude: 46.7 };
      const [direct] = await provider.calculate(request());
      const [viaStop] = await provider.calculate(request({ waypoints: [stop] }));

      expect(viaStop.distanceMeters).toBeGreaterThanOrEqual(direct.distanceMeters);
      expect(viaStop.legs[0].steps.length).toBeGreaterThan(direct.legs[0].steps.length);
    });

    it('takes longer on foot than by car over the same distance', async () => {
      const driving = request();
      const walking = request();
      walking.options.mode = 'walking';

      const [byCar] = await provider.calculate(driving);
      const [onFoot] = await provider.calculate(walking);

      expect(onFoot.durationSeconds).toBeGreaterThan(byCar.durationSeconds);
    });

    it('rejects an out-of-range coordinate', async () => {
      await expect(
        provider.calculate(request({ destination: { latitude: 0, longitude: 999 } })),
      ).rejects.toMatchObject({ code: 'INVALID_LOCATION' });
    });
  });
});
