import { Injectable } from '@nestjs/common';

const DEFAULT_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 3000;

type CacheEntry = { values: Record<string, string>; expiresAt: number };

/**
 * Reads integration credentials at request time, so an admin saving a key in the
 * portal takes effect without restarting anything.
 *
 * Order of preference is the registry in auth-service, then the process
 * environment. The environment fallback is what keeps a service working when
 * auth-service is unreachable, and is also how a fresh checkout runs before
 * anything has been entered in the admin.
 */
@Injectable()
export class IntegrationResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<Record<string, string>>>();

  /** Resolve one field, e.g. `GOOGLE_MAPS_API_KEY`. */
  async get(provider: string, key: string): Promise<string | undefined> {
    const values = await this.values(provider);
    return values[key] || process.env[key] || undefined;
  }

  /** Resolve one field, falling back to a default when nothing is configured. */
  async getOr(provider: string, key: string, fallback: string): Promise<string> {
    return (await this.get(provider, key)) ?? fallback;
  }

  /**
   * Non-blocking read of the last value seen, for the synchronous "is this
   * provider usable?" checks that decide which provider handles a request.
   * Call {@link prime} at startup so this is populated before the first request.
   */
  peek(provider: string, key: string): string | undefined {
    return this.cache.get(provider)?.values[key] || process.env[key] || undefined;
  }

  /** Warm the cache, so {@link peek} can answer before any request arrives. */
  async prime(provider: string): Promise<void> {
    await this.values(provider);
  }

  /** Drop cached values so the next read goes back to the registry. */
  invalidate(provider?: string): void {
    if (provider) this.cache.delete(provider);
    else this.cache.clear();
  }

  private async values(provider: string): Promise<Record<string, string>> {
    const cached = this.cache.get(provider);
    if (cached && cached.expiresAt > Date.now()) return cached.values;

    // Collapse concurrent misses so a burst of requests makes one fetch.
    const existing = this.inFlight.get(provider);
    if (existing) return existing;

    const request = this.fetchValues(provider)
      .then((values) => {
        this.cache.set(provider, { values, expiresAt: Date.now() + this.ttl() });
        return values;
      })
      .catch(() => {
        // Keep serving the last values rather than dropping to environment-only
        // mid-flight, and back off so a burst of requests does not each pay the
        // timeout while auth-service is unreachable.
        const stale = this.cache.get(provider)?.values ?? {};
        this.cache.set(provider, { values: stale, expiresAt: Date.now() + this.ttl() });
        return stale;
      })
      .finally(() => this.inFlight.delete(provider));

    this.inFlight.set(provider, request);
    return request;
  }

  private async fetchValues(provider: string): Promise<Record<string, string>> {
    const base = process.env.AUTH_SERVICE_URL?.replace(/\/$/, '');
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!base || !token) return {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/v1/auth/internal/integrations/${provider}`, {
        headers: { 'x-internal-token': token },
        signal: controller.signal,
      });
      if (!response.ok) return {};
      const body = (await response.json()) as
        | { data?: { values?: Record<string, string> } }
        | { values?: Record<string, string> };
      const values =
        ('data' in body ? body.data?.values : undefined) ??
        ('values' in body ? body.values : undefined);
      return values ?? {};
    } finally {
      clearTimeout(timer);
    }
  }

  private ttl(): number {
    const configured = Number(process.env.INTEGRATION_CACHE_TTL_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MS;
  }
}
