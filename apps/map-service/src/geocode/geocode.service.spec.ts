import { mockConfig } from '../testing/config.mock';
import { mockIntegrations } from '../testing/integrations.mock';
import { GoogleProvider } from '../providers/google/google.provider';
import { MapboxProvider } from '../providers/mapbox/mapbox.provider';
import { OfflineProvider } from '../providers/offline/offline.provider';
import { ProviderRegistry } from '../providers/provider.registry';
import type { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import type { UsageService } from '../usage/usage.service';
import { GeocodeService } from './geocode.service';

const USER = 'user-1';
const ORIGIN = { latitude: 24.7136, longitude: 46.6753 };

type SavedPlaceRow = {
  id: string;
  userId: string;
  label: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
};

/** Minimal in-memory stand-in for the tables this service touches. */
const buildPrismaStub = () => {
  const savedPlaces: SavedPlaceRow[] = [];
  const recentSearches: Array<{ id: string; userId: string; searchedAt: Date; query: string }> = [];
  let sequence = 0;

  return {
    savedPlaces,
    recentSearches,
    client: {
      savedPlace: {
        findMany: async ({ where }: { where: { userId: string } }) =>
          savedPlaces.filter((row) => row.userId === where.userId),
        create: async ({ data }: { data: Omit<SavedPlaceRow, 'id' | 'createdAt'> }) => {
          sequence += 1;
          const row = { ...data, id: `place-${sequence}`, createdAt: new Date() };
          savedPlaces.push(row);
          return row;
        },
        deleteMany: async ({ where }: { where: { userId: string; label?: string; id?: string } }) => {
          for (let i = savedPlaces.length - 1; i >= 0; i -= 1) {
            const row = savedPlaces[i];
            const matches =
              row.userId === where.userId &&
              (where.label === undefined || row.label === where.label) &&
              (where.id === undefined || row.id === where.id);
            if (matches) savedPlaces.splice(i, 1);
          }
          return { count: 0 };
        },
      },
      recentSearch: {
        findMany: async ({ where, skip = 0, take }: { where: { userId: string }; skip?: number; take?: number }) => {
          const rows = recentSearches
            .filter((row) => row.userId === where.userId)
            .sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime())
            .slice(skip);
          return take ? rows.slice(0, take) : rows;
        },
        create: async ({ data }: { data: { userId: string; query: string } }) => {
          sequence += 1;
          const row = { ...data, id: `recent-${sequence}`, searchedAt: new Date(Date.now() + sequence) };
          recentSearches.push(row);
          return row;
        },
        deleteMany: async ({ where }: { where: { userId?: string; id?: { in: string[] } } }) => {
          for (let i = recentSearches.length - 1; i >= 0; i -= 1) {
            const row = recentSearches[i];
            const matches = where.id ? where.id.in.includes(row.id) : row.userId === where.userId;
            if (matches) recentSearches.splice(i, 1);
          }
          return { count: 0 };
        },
      },
    } as unknown as PrismaService,
  };
};

const buildHarness = (env: Record<string, string> = {}) => {
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
  const prisma = buildPrismaStub();

  return {
    service: new GeocodeService(
      registry,
      cache,
      usage as unknown as UsageService,
      prisma.client,
      config,
    ),
    offline,
    usage,
    prisma,
  };
};

describe('GeocodeService', () => {
  describe('search', () => {
    it('returns places for a query', async () => {
      const { service } = buildHarness();
      const places = await service.search(USER, 'coffee', ORIGIN);

      expect(places.length).toBeGreaterThan(0);
      expect(places[0].name).toContain('coffee');
    });

    it('rejects a blank query', async () => {
      const { service } = buildHarness();
      await expect(service.search(USER, '   ')).rejects.toThrow('Search query cannot be empty');
    });

    it('caches repeat searches', async () => {
      const { service, offline, usage } = buildHarness();
      const search = jest.spyOn(offline, 'search');

      await service.search(USER, 'coffee', ORIGIN);
      await service.search(USER, 'coffee', ORIGIN);

      expect(search).toHaveBeenCalledTimes(1);
      expect(usage.track).toHaveBeenCalledWith('offline', 'geocode.search', 'cacheHit');
    });

    it('treats the same query near a different position as a separate lookup', async () => {
      const { service, offline } = buildHarness();
      const search = jest.spyOn(offline, 'search');

      await service.search(USER, 'coffee', ORIGIN);
      await service.search(USER, 'coffee', { latitude: 21.48, longitude: 39.19 });

      expect(search).toHaveBeenCalledTimes(2);
    });

    it('rate limits a user who searches too often', async () => {
      const { service } = buildHarness({ MAP_RATE_LIMIT_PER_MINUTE: '1' });

      await service.search(USER, 'first', ORIGIN);
      await expect(service.search(USER, 'second', ORIGIN)).rejects.toMatchObject({
        code: 'PROVIDER_RATE_LIMITED',
      });
    });
  });

  describe('reverse', () => {
    it('resolves a dropped pin to an address', async () => {
      const { service } = buildHarness();
      const place = await service.reverse(USER, ORIGIN);

      expect(place?.center).toEqual(ORIGIN);
    });

    it('rejects an out-of-range coordinate', async () => {
      const { service } = buildHarness();
      await expect(
        service.reverse(USER, { latitude: 120, longitude: 0 }),
      ).rejects.toMatchObject({ code: 'INVALID_LOCATION' });
    });
  });

  describe('saved places', () => {
    const place = {
      label: 'HOME' as const,
      name: 'Home',
      address: 'Riyadh',
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
    };

    it('saves a place for the user', async () => {
      const { service } = buildHarness();
      const places = await service.savePlace(USER, place);

      expect(places).toHaveLength(1);
      expect(places[0]).toMatchObject({ label: 'HOME', name: 'Home' });
    });

    it('replaces the existing Home rather than adding a second one', async () => {
      const { service } = buildHarness();
      await service.savePlace(USER, place);
      const places = await service.savePlace(USER, { ...place, name: 'New home' });

      expect(places).toHaveLength(1);
      expect(places[0].name).toBe('New home');
    });

    it('keeps Home and Work as separate entries', async () => {
      const { service } = buildHarness();
      await service.savePlace(USER, place);
      const places = await service.savePlace(USER, { ...place, label: 'WORK', name: 'Office' });

      expect(places.map((p) => p.label).sort()).toEqual(['HOME', 'WORK']);
    });

    it('allows several custom places', async () => {
      const { service } = buildHarness();
      await service.savePlace(USER, { ...place, label: 'CUSTOM', name: 'Gym' });
      const places = await service.savePlace(USER, { ...place, label: 'CUSTOM', name: 'Cafe' });

      expect(places).toHaveLength(2);
    });

    it('does not return another user\u2019s places', async () => {
      const { service } = buildHarness();
      await service.savePlace(USER, place);

      await expect(service.listSavedPlaces('user-2')).resolves.toEqual([]);
    });

    it('will not delete a place belonging to someone else', async () => {
      const { service, prisma } = buildHarness();
      await service.savePlace(USER, place);
      const [saved] = prisma.savedPlaces;

      await service.deleteSavedPlace('user-2', saved.id);

      await expect(service.listSavedPlaces(USER)).resolves.toHaveLength(1);
    });
  });

  describe('recent searches', () => {
    const place = {
      id: 'offline:1',
      name: 'Cafe',
      address: 'Riyadh',
      center: ORIGIN,
    };

    it('records a search and returns it most recent first', async () => {
      const { service } = buildHarness();
      await service.recordRecentSearch(USER, 'cafe', place);
      const recent = await service.recordRecentSearch(USER, 'museum', place);

      expect(recent[0].query).toBe('museum');
    });

    it('trims history to the most recent 20 entries', async () => {
      const { service } = buildHarness();
      for (let i = 0; i < 25; i += 1) {
        await service.recordRecentSearch(USER, `query-${i}`, place);
      }

      const recent = await service.listRecentSearches(USER);
      expect(recent).toHaveLength(20);
      expect(recent[0].query).toBe('query-24');
    });

    it('clears history for the user', async () => {
      const { service } = buildHarness();
      await service.recordRecentSearch(USER, 'cafe', place);
      await service.clearRecentSearches(USER);

      await expect(service.listRecentSearches(USER)).resolves.toEqual([]);
    });
  });
});
