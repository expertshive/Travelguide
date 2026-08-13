import type { ConfigService } from '@nestjs/config';
import { ProviderError } from './errors';
import { mockConfig } from '../testing/config.mock';
import { mockIntegrations } from '../testing/integrations.mock';
import { GoogleProvider } from './google/google.provider';
import { MapboxProvider } from './mapbox/mapbox.provider';
import { OfflineProvider } from './offline/offline.provider';
import { ProviderRegistry } from './provider.registry';

/**
 * Provider selection now depends on two sources: which provider is preferred
 * (config) and whether its credentials exist (the integration registry).
 */
type Fixture = { config: ConfigService; credentials: Record<string, string> };

const withToken = (): Fixture => ({
  config: mockConfig({ MAP_PROVIDER: 'mapbox' }),
  credentials: { MAPBOX_ACCESS_TOKEN: 'sk.test' },
});

const withoutToken = (): Fixture => ({
  config: mockConfig({ MAP_PROVIDER: 'mapbox' }),
  credentials: {},
});

const build = ({ config, credentials }: Fixture) => {
  const integrations = mockIntegrations(credentials);
  const google = new GoogleProvider(config, integrations);
  const mapbox = new MapboxProvider(config, integrations);
  const offline = new OfflineProvider();
  return { registry: new ProviderRegistry(config, google, mapbox, offline), mapbox, offline };
};

describe('ProviderRegistry', () => {
  describe('chain', () => {
    it('prefers Mapbox when a token is configured', () => {
      const { registry } = build(withToken());
      expect(registry.chain().map((p) => p.name)).toEqual(['mapbox', 'offline']);
    });

    it('skips Mapbox entirely when no token is configured', () => {
      const { registry } = build(withoutToken());
      expect(registry.chain().map((p) => p.name)).toEqual(['offline']);
      expect(registry.primary().name).toBe('offline');
    });

    it('always keeps offline as a last resort', () => {
      const { registry } = build({
        config: mockConfig({ MAP_PROVIDER: 'something-else' }),
        credentials: {},
      });
      expect(registry.chain().map((p) => p.name)).toEqual(['offline']);
    });
  });

  describe('run', () => {
    it('returns the first provider result without touching the fallback', async () => {
      const { registry, mapbox, offline } = build(withToken());
      jest.spyOn(mapbox, 'search').mockResolvedValue([]);
      const offlineSearch = jest.spyOn(offline, 'search');

      const { provider } = await registry.run('geocode.search', (p) => p.search('cafe'));

      expect(provider).toBe('mapbox');
      expect(offlineSearch).not.toHaveBeenCalled();
    });

    it('falls back to the next provider on a retryable failure', async () => {
      const { registry, mapbox } = build(withToken());
      jest
        .spyOn(mapbox, 'search')
        .mockRejectedValue(new ProviderError('PROVIDER_TIMEOUT', 'timed out', 'mapbox'));

      const { result, provider } = await registry.run('geocode.search', (p) => p.search('cafe'));

      expect(provider).toBe('offline');
      expect(result.length).toBeGreaterThan(0);
    });

    it('falls back when a provider throws an unexpected non-provider error', async () => {
      const { registry, mapbox } = build(withToken());
      jest.spyOn(mapbox, 'search').mockRejectedValue(new TypeError('socket hang up'));

      const { provider } = await registry.run('geocode.search', (p) => p.search('cafe'));

      expect(provider).toBe('offline');
    });

    it('does not retry a domain failure that a second provider cannot fix', async () => {
      const { registry, mapbox, offline } = build(withToken());
      jest
        .spyOn(mapbox, 'search')
        .mockRejectedValue(new ProviderError('INVALID_LOCATION', 'bad point', 'mapbox'));
      const offlineSearch = jest.spyOn(offline, 'search');

      await expect(registry.run('geocode.search', (p) => p.search('cafe'))).rejects.toMatchObject({
        code: 'INVALID_LOCATION',
      });
      expect(offlineSearch).not.toHaveBeenCalled();
    });

    it('surfaces the last error when every provider fails', async () => {
      const { registry, mapbox, offline } = build(withToken());
      jest
        .spyOn(mapbox, 'search')
        .mockRejectedValue(new ProviderError('PROVIDER_TIMEOUT', 'timed out', 'mapbox'));
      jest
        .spyOn(offline, 'search')
        .mockRejectedValue(new ProviderError('PROVIDER_UNAVAILABLE', 'down', 'offline'));

      await expect(registry.run('geocode.search', (p) => p.search('cafe'))).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });

    afterEach(() => jest.restoreAllMocks());
  });

  describe('getStyleConfig', () => {
    it('reports which provider the client should render with', () => {
      const { registry } = build(withoutToken());
      expect(registry.getStyleConfig()).toMatchObject({ provider: 'offline', publicToken: null });
    });
  });
});
