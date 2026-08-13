import { haversineMeters, isValidLatLng, polylineLengthMeters, snapToRoute } from './geo.util';
import type { Route } from './types';

const route = (points: Array<[number, number]>): Route => ({
  id: 'test',
  geometry: points.map(([latitude, longitude]) => ({ latitude, longitude })),
  distanceMeters: 0,
  durationSeconds: 0,
  legs: [],
  summary: 'test',
});

describe('geo utilities', () => {
  describe('isValidLatLng', () => {
    it('accepts in-range coordinates', () => {
      expect(isValidLatLng({ latitude: 24.7, longitude: 46.6 })).toBe(true);
    });

    it.each([
      ['latitude above 90', { latitude: 91, longitude: 0 }],
      ['longitude below -180', { latitude: 0, longitude: -181 }],
      ['NaN latitude', { latitude: Number.NaN, longitude: 0 }],
    ])('rejects %s', (_label, point) => {
      expect(isValidLatLng(point)).toBe(false);
    });

    it('rejects a missing point', () => {
      expect(isValidLatLng(undefined)).toBe(false);
    });
  });

  describe('haversineMeters', () => {
    it('measures a known distance', () => {
      // Riyadh to Jeddah is roughly 850 km.
      const distance = haversineMeters(
        { latitude: 24.7136, longitude: 46.6753 },
        { latitude: 21.4858, longitude: 39.1925 },
      );
      expect(distance).toBeGreaterThan(840_000);
      expect(distance).toBeLessThan(860_000);
    });

    it('is zero for the same point', () => {
      const point = { latitude: 24.7136, longitude: 46.6753 };
      expect(haversineMeters(point, point)).toBe(0);
    });
  });

  describe('snapToRoute', () => {
    const straight = route([
      [24.7, 46.6],
      [24.71, 46.6],
      [24.72, 46.6],
    ]);

    it('reports a near-zero distance for a point on the line', () => {
      const { distanceMeters } = snapToRoute(straight, { latitude: 24.705, longitude: 46.6 });
      expect(distanceMeters).toBeLessThan(1);
    });

    it('reports the perpendicular distance for a point beside the line', () => {
      const { distanceMeters } = snapToRoute(straight, { latitude: 24.705, longitude: 46.61 });
      // ~0.01 degrees of longitude at this latitude is roughly 1 km.
      expect(distanceMeters).toBeGreaterThan(800);
      expect(distanceMeters).toBeLessThan(1200);
    });

    it('identifies which segment the traveller is nearest to', () => {
      const { index } = snapToRoute(straight, { latitude: 24.7195, longitude: 46.6 });
      expect(index).toBe(1);
    });

    it('handles a single-point route without dividing by zero', () => {
      const { distanceMeters } = snapToRoute(route([[24.7, 46.6]]), {
        latitude: 24.7,
        longitude: 46.6,
      });
      expect(distanceMeters).toBe(0);
    });
  });

  it('sums polyline length across segments', () => {
    const points = [
      { latitude: 24.7, longitude: 46.6 },
      { latitude: 24.71, longitude: 46.6 },
      { latitude: 24.72, longitude: 46.6 },
    ];
    const total = polylineLengthMeters(points);
    const firstLeg = haversineMeters(points[0], points[1]);
    expect(total).toBeCloseTo(firstLeg * 2, 0);
  });
});
