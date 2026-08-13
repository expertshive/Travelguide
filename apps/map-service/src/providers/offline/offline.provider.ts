import { Injectable } from '@nestjs/common';
import { ProviderError } from '../errors';
import { haversineMeters, isValidLatLng, snapToRoute } from '../geo.util';
import type {
  GeocodingProvider,
  LatLng,
  MapProvider,
  NavigationProvider,
  Place,
  Route,
  RouteRequest,
  RouteStep,
  RoutingProvider,
  TrafficProvider,
  TrafficSegment,
  TravelMode,
} from '../types';

/** Rough average speeds, metres per second, used to synthesise durations. */
const SPEED_BY_MODE: Record<TravelMode, number> = {
  driving: 13.9,
  motorcycle: 12.5,
  walking: 1.4,
  cycling: 4.2,
};

/**
 * Deterministic provider used when no Mapbox token is configured and as the
 * last-resort fallback when the live provider is failing.
 *
 * Geometry is interpolated in a straight line, so distances are optimistic and
 * it never follows real roads. It exists to keep the app, tests, and CI working
 * offline — it is not a substitute for a real provider.
 */
@Injectable()
export class OfflineProvider
  implements MapProvider, GeocodingProvider, RoutingProvider, NavigationProvider, TrafficProvider
{
  readonly name = 'offline';

  getStyleConfig() {
    return {
      styleUrl: 'offline://raster/osm',
      publicToken: null,
      attribution: '© OpenStreetMap contributors',
    };
  }

  async search(query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const origin: LatLng = isValidLatLng(near)
      ? near
      : { latitude: 24.7136, longitude: 46.6753 };

    // Spread synthetic results in a small ring so the UI has distinct pins.
    return Array.from({ length: Math.min(limit, 5) }, (_, index) => {
      const offset = (index + 1) * 0.008;
      const center: LatLng = {
        latitude: origin.latitude + offset * Math.cos(index),
        longitude: origin.longitude + offset * Math.sin(index),
      };
      return {
        id: `${this.name}:${trimmed}:${index}`,
        name: index === 0 ? trimmed : `${trimmed} ${index + 1}`,
        address: `${trimmed}, sample result ${index + 1}`,
        center,
        distanceMeters: haversineMeters(origin, center),
      };
    });
  }

  async reverse(point: LatLng): Promise<Place | null> {
    if (!isValidLatLng(point)) {
      throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range', this.name);
    }

    return {
      id: `${this.name}:${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`,
      name: 'Dropped pin',
      address: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`,
      center: point,
    };
  }

  async calculate(request: RouteRequest): Promise<Route[]> {
    const { origin, destination, waypoints, options } = request;

    for (const point of [origin, destination, ...waypoints]) {
      if (!isValidLatLng(point)) {
        throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range', this.name);
      }
    }

    const anchors = [origin, ...waypoints, destination];
    const primary = this.buildRoute(anchors, options.mode, 0, 'Fastest');
    if (!options.alternatives) return [primary];

    // A second, slightly bowed variant so alternative selection is exercisable.
    const bowed = this.buildRoute(anchors, options.mode, 0.004, 'Alternative 1');
    return [primary, bowed];
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

  private buildRoute(anchors: LatLng[], mode: TravelMode, bow: number, summary: string): Route {
    const geometry: LatLng[] = [];
    const steps: RouteStep[] = [];
    let distanceMeters = 0;

    for (let i = 0; i < anchors.length - 1; i += 1) {
      const from = anchors[i];
      const to = anchors[i + 1];
      const legDistance = haversineMeters(from, to);
      distanceMeters += legDistance;

      const segments = 12;
      for (let s = 0; s < segments; s += 1) {
        const t = s / segments;
        // Offset mid-segment points to bow the alternative away from the primary.
        const lift = bow * Math.sin(Math.PI * t);
        geometry.push({
          latitude: from.latitude + (to.latitude - from.latitude) * t + lift,
          longitude: from.longitude + (to.longitude - from.longitude) * t + lift,
        });
      }

      steps.push({
        instruction: i === 0 ? 'Head toward your destination' : `Continue to stop ${i}`,
        distanceMeters: legDistance,
        durationSeconds: legDistance / SPEED_BY_MODE[mode],
        maneuver: i === 0 ? 'depart' : 'continue',
        bearingAfter: -1,
        location: from,
      });
    }

    geometry.push(anchors[anchors.length - 1]);
    steps.push({
      instruction: 'Arrive at your destination',
      distanceMeters: 0,
      durationSeconds: 0,
      maneuver: 'arrive',
      bearingAfter: -1,
      location: anchors[anchors.length - 1],
    });

    const bowPenalty = 1 + bow * 20;
    const finalDistance = distanceMeters * bowPenalty;
    const durationSeconds = finalDistance / SPEED_BY_MODE[mode];

    return {
      id: `${this.name}:${summary.toLowerCase().replace(/\s+/g, '-')}`,
      geometry,
      distanceMeters: finalDistance,
      durationSeconds,
      legs: [{ distanceMeters: finalDistance, durationSeconds, steps }],
      summary,
    };
  }
}
