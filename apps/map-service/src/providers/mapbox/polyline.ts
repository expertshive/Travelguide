import type { LatLng } from '../types';

/**
 * Decode an encoded polyline. Mapbox Directions returns precision 6
 * (`polyline6`); the classic format is precision 5.
 */
export function decodePolyline(encoded: string, precision = 6): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += decodeSignedValue();
    lng += decodeSignedValue();
    points.push({ latitude: lat / factor, longitude: lng / factor });
  }

  return points;

  function decodeSignedValue(): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    // Least-significant bit is the sign flag.
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}

/** Encode coordinates back into a polyline. Used by tests and fixtures. */
export function encodePolyline(points: LatLng[], precision = 6): string {
  const factor = 10 ** precision;
  let output = '';
  let previousLat = 0;
  let previousLng = 0;

  for (const point of points) {
    const lat = Math.round(point.latitude * factor);
    const lng = Math.round(point.longitude * factor);
    output += encodeSignedValue(lat - previousLat) + encodeSignedValue(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }

  return output;

  function encodeSignedValue(value: number): string {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = '';
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    chunk += String.fromCharCode(v + 63);
    return chunk;
  }
}
