import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderError } from '../providers/errors';
import { isValidLatLng } from '../providers/geo.util';
import { ProviderRegistry } from '../providers/provider.registry';
import type { LatLng, Place } from '../providers/types';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { UsageService } from '../usage/usage.service';
import type { SavePlaceDto } from './dto/geocode.dto';

const SEARCH_TTL_SECONDS = 60 * 60 * 6;
const REVERSE_TTL_SECONDS = 60 * 60 * 24;
const RECENT_SEARCH_LIMIT = 20;

@Injectable()
export class GeocodeService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly cache: CacheService,
    private readonly usage: UsageService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async search(userId: string, query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const trimmed = query.trim();
    if (!trimmed) throw new BadRequestException('Search query cannot be empty');

    const cacheKey = this.searchKey(trimmed, near, limit);
    const cached = await this.cache.get<Place[]>(cacheKey);
    if (cached) {
      this.usage.track(this.registry.primary().name, 'geocode.search', 'cacheHit');
      return cached;
    }

    await this.enforceRateLimit(userId, 'geocode');

    const { result, provider } = await this.runTracked('geocode.search', (p) =>
      p.search(trimmed, near, limit),
    );

    await this.cache.set(cacheKey, result, SEARCH_TTL_SECONDS);
    void provider;
    return result;
  }

  async reverse(userId: string, point: LatLng): Promise<Place | null> {
    if (!isValidLatLng(point)) {
      throw new ProviderError('INVALID_LOCATION', 'Coordinates are out of range');
    }

    const cacheKey = `geocode:reverse:${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
    const cached = await this.cache.get<Place>(cacheKey);
    if (cached) {
      this.usage.track(this.registry.primary().name, 'geocode.reverse', 'cacheHit');
      return cached;
    }

    await this.enforceRateLimit(userId, 'geocode');

    const { result } = await this.runTracked('geocode.reverse', (p) => p.reverse(point));
    if (result) await this.cache.set(cacheKey, result, REVERSE_TTL_SECONDS);
    return result;
  }

  async recordRecentSearch(userId: string, query: string, place: Place) {
    await this.prisma.recentSearch.create({
      data: {
        userId,
        query,
        name: place.name,
        address: place.address,
        latitude: place.center.latitude,
        longitude: place.center.longitude,
      },
    });

    // Keep the list bounded so it stays a "recent" list rather than full history.
    const stale = await this.prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { searchedAt: 'desc' },
      skip: RECENT_SEARCH_LIMIT,
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.recentSearch.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }

    return this.listRecentSearches(userId);
  }

  listRecentSearches(userId: string) {
    return this.prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { searchedAt: 'desc' },
      take: RECENT_SEARCH_LIMIT,
    });
  }

  clearRecentSearches(userId: string) {
    return this.prisma.recentSearch.deleteMany({ where: { userId } });
  }

  listSavedPlaces(userId: string) {
    return this.prisma.savedPlace.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async savePlace(userId: string, dto: SavePlaceDto) {
    // HOME and WORK are singletons per user; CUSTOM entries accumulate.
    if (dto.label === 'HOME' || dto.label === 'WORK') {
      await this.prisma.savedPlace.deleteMany({ where: { userId, label: dto.label } });
    }

    await this.prisma.savedPlace.create({
      data: {
        userId,
        label: dto.label,
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    return this.listSavedPlaces(userId);
  }

  async deleteSavedPlace(userId: string, id: string) {
    await this.prisma.savedPlace.deleteMany({ where: { id, userId } });
    return this.listSavedPlaces(userId);
  }

  private async runTracked<T>(
    operation: string,
    fn: (provider: ReturnType<ProviderRegistry['primary']>) => Promise<T>,
  ) {
    try {
      const outcome = await this.registry.run(operation, fn);
      this.usage.track(outcome.provider, operation, 'request');
      return outcome;
    } catch (error) {
      this.usage.track(this.registry.primary().name, operation, 'error');
      throw error;
    }
  }

  private async enforceRateLimit(userId: string, bucket: string) {
    const limit = Number(this.config.get<string>('MAP_RATE_LIMIT_PER_MINUTE') ?? 60);
    const { allowed } = await this.cache.consumeRateLimit(`${bucket}:${userId}`, limit, 60);
    if (!allowed) {
      throw new ProviderError('PROVIDER_RATE_LIMITED', 'Too many map requests, slow down');
    }
  }

  private searchKey(query: string, near: LatLng | undefined, limit: number) {
    const proximity = near ? `${near.latitude.toFixed(3)},${near.longitude.toFixed(3)}` : 'none';
    return `geocode:search:${query.toLowerCase()}:${proximity}:${limit}`;
  }
}
