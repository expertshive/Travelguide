import type { LatLng, Route } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function isValidLatLng(point: LatLng | undefined | null): point is LatLng {
  return (
    !!point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Perpendicular distance from `point` to segment `a`→`b`, in metres. */
export function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng): number {
  const ax = a.longitude;
  const ay = a.latitude;
  const bx = b.longitude;
  const by = b.latitude;
  const px = point.longitude;
  const py = point.latitude;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) return haversineMeters(point, a);

  // Project the point onto the segment, clamped to its endpoints.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const closest: LatLng = { longitude: ax + t * dx, latitude: ay + t * dy };
  return haversineMeters(point, closest);
}

/**
 * Nearest point on the route to `position`.
 * Returns the index of the segment start and the distance to it.
 */
export function snapToRoute(
  route: Route,
  position: LatLng,
): { index: number; distanceMeters: number } {
  if (route.geometry.length === 0) return { index: 0, distanceMeters: Number.POSITIVE_INFINITY };
  if (route.geometry.length === 1) {
    return { index: 0, distanceMeters: haversineMeters(position, route.geometry[0]) };
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < route.geometry.length - 1; i += 1) {
    const distance = distanceToSegmentMeters(position, route.geometry[i], route.geometry[i + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return { index: bestIndex, distanceMeters: bestDistance };
}

/** Total length of a coordinate list in metres. */
export function polylineLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineMeters(points[i], points[i + 1]);
  }
  return total;
}
