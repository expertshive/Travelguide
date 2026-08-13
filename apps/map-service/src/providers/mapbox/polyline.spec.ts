import { decodePolyline, encodePolyline } from './polyline';

describe('polyline', () => {
  it('decodes the reference precision-5 polyline from the Google spec', () => {
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);

    expect(points).toHaveLength(3);
    expect(points[0].latitude).toBeCloseTo(38.5, 5);
    expect(points[0].longitude).toBeCloseTo(-120.2, 5);
    expect(points[2].latitude).toBeCloseTo(43.252, 5);
    expect(points[2].longitude).toBeCloseTo(-126.453, 5);
  });

  it('round-trips coordinates at precision 6, which is what Mapbox returns', () => {
    const original = [
      { latitude: 24.7136, longitude: 46.6753 },
      { latitude: 24.7201, longitude: 46.6814 },
      { latitude: 24.7333, longitude: 46.7011 },
    ];

    const decoded = decodePolyline(encodePolyline(original, 6), 6);

    expect(decoded).toHaveLength(original.length);
    decoded.forEach((point, index) => {
      expect(point.latitude).toBeCloseTo(original[index].latitude, 6);
      expect(point.longitude).toBeCloseTo(original[index].longitude, 6);
    });
  });

  it('returns nothing for an empty geometry', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});
