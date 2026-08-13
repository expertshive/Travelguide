import { ProviderError } from '../errors';
import { mockConfig } from '../../testing/config.mock';
import { mockIntegrations } from '../../testing/integrations.mock';
import { DEFAULT_AVOID, type RouteRequest } from '../types';
import { MapboxProvider } from './mapbox.provider';
import { encodePolyline } from './polyline';

const ORIGIN = { latitude: 24.7136, longitude: 46.6753 };
const DESTINATION = { latitude: 24.7743, longitude: 46.7386 };

/** Credentials come from the integration registry; plain settings from config. */
const provider = (
  credentials: Record<string, string> = {},
  configValues: Record<string, string> = {},
) =>
  new MapboxProvider(
    mockConfig(configValues),
    mockIntegrations({ MAPBOX_ACCESS_TOKEN: 'sk.test-token', ...credentials }),
  );

/** A provider with nothing configured at all. */
const unconfigured = () => new MapboxProvider(mockConfig(), mockIntegrations());

const routeRequest = (overrides: Partial<RouteRequest> = {}): RouteRequest => ({
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

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('MapboxProvider', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('configuration', () => {
    it('is not configured without a token', () => {
      expect(unconfigured().isConfigured()).toBe(false);
    });

    it('never exposes the secret server token in the client style config', () => {
      const style = provider({ MAPBOX_PUBLIC_TOKEN: 'pk.public-token' }).getStyleConfig();

      expect(style.publicToken).toBe('pk.public-token');
      expect(JSON.stringify(style)).not.toContain('sk.test-token');
    });
  });

  describe('search', () => {
    it('normalises Mapbox features into places', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          features: [
            {
              id: 'poi.123',
              text: 'King Fahd Road',
              place_name: 'King Fahd Road, Riyadh',
              center: [46.6753, 24.7136],
            },
          ],
        }),
      );

      const places = await provider().search('king fahd', ORIGIN);

      expect(places).toHaveLength(1);
      expect(places[0]).toMatchObject({
        id: 'mapbox:poi.123',
        name: 'King Fahd Road',
        address: 'King Fahd Road, Riyadh',
        center: { latitude: 24.7136, longitude: 46.6753 },
      });
      expect(places[0].distanceMeters).toBeCloseTo(0, 0);
    });

    it('drops features that have no coordinates', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ features: [{ id: 'poi.1', text: 'Nowhere' }] }),
      );

      await expect(provider().search('nowhere')).resolves.toEqual([]);
    });

    it('biases results toward the supplied position', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ features: [] }));

      await provider().search('cafe', ORIGIN);

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain(`proximity=${encodeURIComponent('46.6753,24.7136')}`);
    });
  });

  describe('calculate', () => {
    it('decodes geometry and normalises steps', async () => {
      const geometry = encodePolyline([ORIGIN, DESTINATION], 6);
      fetchMock.mockResolvedValue(
        jsonResponse({
          code: 'Ok',
          routes: [
            {
              geometry,
              distance: 8200,
              duration: 900,
              legs: [
                {
                  distance: 8200,
                  duration: 900,
                  steps: [
                    {
                      distance: 8200,
                      duration: 900,
                      maneuver: {
                        type: 'depart',
                        instruction: 'Head north',
                        bearing_after: 12,
                        location: [46.6753, 24.7136],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      );

      const [route] = await provider().calculate(routeRequest());

      expect(route.distanceMeters).toBe(8200);
      expect(route.durationSeconds).toBe(900);
      expect(route.geometry).toHaveLength(2);
      expect(route.geometry[0].latitude).toBeCloseTo(ORIGIN.latitude, 5);
      expect(route.legs[0].steps[0]).toMatchObject({
        instruction: 'Head north',
        maneuver: 'depart',
        bearingAfter: 12,
      });
    });

    it('maps an unrecognised maneuver to "continue"', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          code: 'Ok',
          routes: [
            {
              geometry: encodePolyline([ORIGIN, DESTINATION], 6),
              distance: 100,
              duration: 10,
              legs: [
                {
                  steps: [{ maneuver: { type: 'off-ramp', instruction: 'Take the ramp' } }],
                },
              ],
            },
          ],
        }),
      );

      const [route] = await provider().calculate(routeRequest());
      expect(route.legs[0].steps[0].maneuver).toBe('continue');
    });

    it('sorts by distance when the caller asks for the shortest route', async () => {
      const geometry = encodePolyline([ORIGIN, DESTINATION], 6);
      fetchMock.mockResolvedValue(
        jsonResponse({
          code: 'Ok',
          routes: [
            { geometry, distance: 9000, duration: 600, legs: [] },
            { geometry, distance: 7000, duration: 900, legs: [] },
          ],
        }),
      );

      const request = routeRequest();
      request.options.preference = 'shortest';
      const routes = await provider().calculate(request);

      expect(routes[0].distanceMeters).toBe(7000);
    });

    it('translates avoid options into Mapbox exclusions', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          code: 'Ok',
          routes: [{ geometry: encodePolyline([ORIGIN, DESTINATION], 6), distance: 1, duration: 1, legs: [] }],
        }),
      );

      const request = routeRequest();
      request.options.avoid = { tolls: true, highways: true, ferries: false, unpaved: false };
      await provider().calculate(request);

      const url = fetchMock.mock.calls[0][0] as string;
      expect(decodeURIComponent(url)).toContain('exclude=toll,motorway');
    });

    it('raises NO_ROUTE_FOUND when Mapbox finds nothing', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ code: 'NoRoute', routes: [] }));

      await expect(provider().calculate(routeRequest())).rejects.toMatchObject({
        code: 'NO_ROUTE_FOUND',
      });
    });

    it('rejects out-of-range coordinates before making a request', async () => {
      const request = routeRequest({ destination: { latitude: 200, longitude: 46 } });

      await expect(provider().calculate(request)).rejects.toMatchObject({
        code: 'INVALID_LOCATION',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('error translation', () => {
    it('maps HTTP 429 to a retryable rate-limit error', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 429));

      const error = await provider()
        .search('anything')
        .catch((e: ProviderError) => e);

      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe('PROVIDER_RATE_LIMITED');
      expect((error as ProviderError).isRetryable).toBe(true);
    });

    it('maps a rejected token to PROVIDER_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 401));

      await expect(provider().search('anything')).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });

    it('maps an aborted request to a timeout', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      fetchMock.mockRejectedValue(abortError);

      await expect(provider().search('anything')).rejects.toMatchObject({
        code: 'PROVIDER_TIMEOUT',
      });
    });

    it('fails fast when no token is configured', async () => {
      await expect(unconfigured().search('anything')).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
