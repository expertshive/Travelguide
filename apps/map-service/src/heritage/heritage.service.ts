import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderError } from '../providers/errors';
import {
  haversineMeters,
  minDistanceToPolyline,
  sampleAlongPolyline,
  sideOfHeading,
} from '../providers/geo.util';
import { GoogleProvider } from '../providers/google/google.provider';
import type { LatLng, Place } from '../providers/types';
import { CacheService } from '../redis/cache.service';
import { UsageService } from '../usage/usage.service';
import type { HeritageSite } from './types';
import { wikipediaNear } from './wikipedia';

const HISTORIC_TYPES = new Set([
  'hindu_temple',
  'mosque',
  'church',
  'synagogue',
  'place_of_worship',
  'cemetery',
  'museum',
]);

const EXCLUDE_TYPES = new Set([
  'amusement_park',
  'aquarium',
  'zoo',
  'shopping_mall',
  'restaurant',
  'cafe',
  'bar',
  'lodging',
  'store',
  'movie_theater',
  'night_club',
  'gas_station',
  'parking',
  'supermarket',
]);

const NAME_HINT =
  /\b(fort|qila|temple|mandir|mosque|masjid|church|cathedral|chapel|museum|heritage|palace|tomb|mausoleum|ruin|archaeolog|stupa|minar|haveli|dargah|gurdwara|synagogue|monument|citadel|settlement)\b/i;

const MAX_SAMPLES = 10;
const MAX_SITES = 18;

@Injectable()
export class HeritageService {
  constructor(
    private readonly google: GoogleProvider,
    private readonly cache: CacheService,
    private readonly usage: UsageService,
    private readonly config: ConfigService,
  ) {}

  async alongRoute(
    userId: string,
    geometry: LatLng[],
    radiusMeters: number,
    origin?: LatLng,
  ): Promise<HeritageSite[]> {
    const line = geometry
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (line.length < 2) return [];
    const step = line.length > 400 ? Math.ceil(line.length / 400) : 1;
    const thinned =
      step === 1
        ? line
        : line.filter((_, i) => i % step === 0 || i === line.length - 1);

    const cacheKey = this.cacheKey(thinned, radiusMeters);
    const cached = await this.cache.get<HeritageSite[]>(cacheKey);
    if (cached) {
      this.usage.track('google', 'heritage.alongRoute', 'cacheHit');
      return this.withOriginDistance(cached, origin);
    }

    await this.enforceRateLimit(userId);

    let raw: Place[] = [];
    if (this.google.isConfigured()) {
      const interval = Math.max(radiusMeters * 1.4, 4000);
      const samples = sampleAlongPolyline(thinned, interval).slice(0, MAX_SAMPLES);
      const batches = await Promise.all(
        samples.map((pt) => this.google.nearbyHistoric(pt, radiusMeters).catch(() => [] as Place[])),
      );
      raw = batches.flat();
      this.usage.track('google', 'heritage.alongRoute', 'request');
    }

    const unique = this.dedupe(raw);
    const along: HeritageSite[] = [];

    for (const place of unique) {
      if (along.length >= MAX_SITES) break;
      const onRoute = minDistanceToPolyline(place.center, thinned);
      if (onRoute.meters > radiusMeters) continue;

      const details = this.google.isConfigured()
        ? await this.google.placeDetails(place.id).catch(() => null)
        : null;
      if (details?.businessStatus === 'CLOSED_PERMANENTLY') continue;

      const types = details?.types ?? (place.category ? [place.category] : []);
      if (!this.isHeritage(place.name, types)) continue;
      if (types.some((t) => EXCLUDE_TYPES.has(t)) && !NAME_HINT.test(place.name)) continue;

      const visitable = details?.businessStatus !== 'CLOSED_TEMPORARILY';
      if (!visitable && details?.businessStatus) continue;

      const wiki = await wikipediaNear(place.center.latitude, place.center.longitude, place.name);
      const category = this.labelCategory(types, place.name);
      const visit = this.visitWindow(types);
      const ahead = thinned[Math.min(onRoute.index + 1, thinned.length - 1)];
      const from = thinned[onRoute.index];

      const story = wiki
        ? wiki.extract
        : `${place.name} is a ${category} along this route. I don't have a verified historical date for it, so I won't invent one.`;

      along.push({
        id: place.id,
        name: place.name,
        address: place.address,
        center: place.center,
        category,
        routeDistanceMeters: Math.round(onRoute.meters),
        originDistanceMeters: origin ? Math.round(haversineMeters(origin, place.center)) : null,
        alongIndex: onRoute.index,
        side: sideOfHeading(from, ahead, place.center),
        visitable: true,
        openNow: details?.openNow ?? null,
        hoursSummary: details?.weekdayText?.[0] ?? null,
        visitMinutes: visit,
        ageLabel: wiki?.ageLabel ?? null,
        ageSource: wiki?.ageSource ?? 'unknown',
        whyImportant: wiki
          ? wiki.extract.split(/(?<=[.!?])\s+/)[0] ?? wiki.extract
          : `A ${category} close to the driving line.`,
        story,
        storyLong: wiki?.extract ?? null,
        source: wiki ? 'wikipedia' : 'maps',
      });
    }

    along.sort((a, b) => {
      const rank = (s: HeritageSite) =>
        (s.source === 'wikipedia' ? 0 : 2) +
        (s.ageSource === 'unknown' ? 1 : 0) +
        s.routeDistanceMeters / 1000;
      return rank(a) - rank(b) || a.alongIndex - b.alongIndex;
    });

    await this.cache.set(cacheKey, along, 60 * 60 * 6);
    return this.withOriginDistance(along, origin);
  }

  private withOriginDistance(sites: HeritageSite[], origin?: LatLng): HeritageSite[] {
    if (!origin) return sites;
    return sites.map((s) => ({
      ...s,
      originDistanceMeters: Math.round(haversineMeters(origin, s.center)),
    }));
  }

  private isHeritage(name: string, types: string[]): boolean {
    if (NAME_HINT.test(name)) return true;
    return types.some((t) => HISTORIC_TYPES.has(t));
  }

  private labelCategory(types: string[], name: string): string {
    if (types.includes('hindu_temple') || /mandir|temple/i.test(name)) return 'temple';
    if (types.includes('mosque') || /masjid|mosque/i.test(name)) return 'mosque';
    if (types.includes('church') || /church|cathedral/i.test(name)) return 'church';
    if (types.includes('museum')) return 'museum';
    if (/fort|qila|citadel/i.test(name)) return 'fort';
    if (/archaeolog|ruin|stupa/i.test(name)) return 'archaeological site';
    if (types.includes('place_of_worship')) return 'place of worship';
    return 'heritage site';
  }

  private visitWindow(types: string[]): { min: number; max: number } {
    if (types.includes('museum') || /archaeolog/.test(types.join(' '))) return { min: 45, max: 90 };
    if (/fort|palace|citadel/.test(types.join(' '))) return { min: 30, max: 60 };
    return { min: 15, max: 30 };
  }

  private dedupe(places: Place[]): Place[] {
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const p of places) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }

  private cacheKey(line: LatLng[], radius: number): string {
    const n = line.length;
    const a = line[0];
    const m = line[Math.floor(n / 2)];
    const z = line[n - 1];
    return `heritage:${radius}:${n}:${a.latitude.toFixed(3)},${a.longitude.toFixed(3)}:${m.latitude.toFixed(3)}:${z.latitude.toFixed(3)},${z.longitude.toFixed(3)}`;
  }

  private async enforceRateLimit(userId: string) {
    const limit = Number(this.config.get<string>('MAP_RATE_LIMIT_PER_MINUTE') ?? 60);
    const { allowed } = await this.cache.consumeRateLimit(`heritage:${userId}`, limit, 60);
    if (!allowed) {
      throw new ProviderError('PROVIDER_RATE_LIMITED', 'Too many map requests, slow down');
    }
  }
}
