import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@traveler-guide/logger';
import { ProviderError } from './errors';
import { GoogleProvider } from './google/google.provider';
import { MapboxProvider } from './mapbox/mapbox.provider';
import { OfflineProvider } from './offline/offline.provider';
import type {
  GeocodingProvider,
  MapProvider,
  NavigationProvider,
  RoutingProvider,
  TrafficProvider,
} from './types';

type AnyProvider = MapProvider &
  GeocodingProvider &
  RoutingProvider &
  NavigationProvider &
  TrafficProvider;

/**
 * Chooses which map provider serves a request and degrades to the next one
 * when the preferred provider fails in a retryable way.
 *
 * Adding Google Maps or OpenStreetMap later means implementing the provider
 * interfaces and inserting the instance into `chain()` — no caller changes.
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = createLogger('ProviderRegistry');

  constructor(
    private readonly config: ConfigService,
    private readonly google: GoogleProvider,
    private readonly mapbox: MapboxProvider,
    private readonly offline: OfflineProvider,
  ) {}

  /** Providers in preference order. */
  chain(): AnyProvider[] {
    const preferred = this.config.get<string>('MAP_PROVIDER') ?? 'mapbox';
    const chain: AnyProvider[] = [];

    if (preferred === 'google' && this.google.isConfigured()) {
      chain.push(this.google);
    }
    if (preferred === 'mapbox' && this.mapbox.isConfigured()) {
      chain.push(this.mapbox);
    }
    // A configured real provider still backs up the other, before offline.
    if (preferred !== 'google' && this.google.isConfigured()) {
      chain.push(this.google);
    }
    if (preferred !== 'mapbox' && this.mapbox.isConfigured()) {
      chain.push(this.mapbox);
    }
    chain.push(this.offline);
    return chain;
  }

  primary(): AnyProvider {
    return this.chain()[0];
  }

  /** Style/token config for the mobile client. Never returns a secret token. */
  getStyleConfig() {
    const provider = this.primary();
    return { provider: provider.name, ...provider.getStyleConfig() };
  }

  /**
   * Run `operation` against each provider in turn, moving on only when the
   * failure is retryable. Domain failures such as NO_ROUTE_FOUND or
   * INVALID_LOCATION stop immediately — a second provider would not help.
   */
  async run<T>(
    label: string,
    operation: (provider: AnyProvider) => Promise<T>,
  ): Promise<{ result: T; provider: string }> {
    const providers = this.chain();
    let lastError: unknown;

    for (const provider of providers) {
      try {
        const result = await operation(provider);
        return { result, provider: provider.name };
      } catch (error) {
        lastError = error;

        if (error instanceof ProviderError && !error.isRetryable) throw error;

        this.logger.warn('Provider failed, trying next', {
          label,
          provider: provider.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (lastError instanceof ProviderError) throw lastError;
    throw new ProviderError('PROVIDER_UNAVAILABLE', `All providers failed for ${label}`);
  }
}
