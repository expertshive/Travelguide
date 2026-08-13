import { mockConfig } from '../testing/config.mock';
import { CacheService } from './cache.service';

/** Exercises the in-process fallback, which is what runs without REDIS_URL. */
describe('CacheService without Redis', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(mockConfig());
    cache.onModuleInit();
  });

  it('returns null for a key that was never set', async () => {
    await expect(cache.get('missing')).resolves.toBeNull();
  });

  it('round-trips a structured value', async () => {
    await cache.set('place', { name: 'Riyadh', center: { latitude: 24.7 } }, 60);
    await expect(cache.get('place')).resolves.toEqual({
      name: 'Riyadh',
      center: { latitude: 24.7 },
    });
  });

  it('expires a value once its TTL has passed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await cache.set('short', 'value', 10);

    jest.setSystemTime(new Date('2026-01-01T00:00:11Z'));
    await expect(cache.get('short')).resolves.toBeNull();

    jest.useRealTimers();
  });

  describe('rate limiting', () => {
    it('allows calls up to the limit and blocks the next one', async () => {
      const first = await cache.consumeRateLimit('user-1', 2, 60);
      const second = await cache.consumeRateLimit('user-1', 2, 60);
      const third = await cache.consumeRateLimit('user-1', 2, 60);

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(0);
      expect(third.allowed).toBe(false);
    });

    it('counts each key separately', async () => {
      await cache.consumeRateLimit('user-1', 1, 60);
      await expect(cache.consumeRateLimit('user-2', 1, 60)).resolves.toMatchObject({
        allowed: true,
      });
    });

    it('resets when the window rolls over', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
      await cache.consumeRateLimit('user-1', 1, 60);
      await expect(cache.consumeRateLimit('user-1', 1, 60)).resolves.toMatchObject({
        allowed: false,
      });

      jest.setSystemTime(new Date('2026-01-01T00:01:30Z'));
      await expect(cache.consumeRateLimit('user-1', 1, 60)).resolves.toMatchObject({
        allowed: true,
      });

      jest.useRealTimers();
    });
  });
});
