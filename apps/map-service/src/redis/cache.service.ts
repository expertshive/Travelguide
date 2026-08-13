import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@traveler-guide/logger';
import Redis from 'ioredis';

type MemoryEntry = { value: string; expiresAt: number };

/**
 * Cache and fixed-window rate limiting for provider calls.
 *
 * Redis is optional: without `REDIS_URL` (local dev, CI, unit tests) this falls
 * back to an in-process map so the service stays usable rather than failing.
 * The fallback is per-process, so it is not a substitute for Redis in a real
 * multi-instance deployment.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('CacheService');
  private client: Redis | null = null;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — using in-process cache fallback');
      return;
    }

    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.client.on('error', (err: Error) => {
      this.logger.warn('Redis unavailable, serving from in-process cache', {
        message: err.message,
      });
    });
    void this.client.connect().catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.isLive()) {
      try {
        await this.client!.set(key, raw, 'EX', ttlSeconds);
        return;
      } catch {
        // fall through to memory
      }
    }
    this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  /**
   * Fixed-window counter. Returns whether the caller is still within `limit`
   * for the current `windowSeconds` bucket.
   */
  async consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const counterKey = `ratelimit:${key}:${bucket}`;

    let count: number;
    if (this.isLive()) {
      try {
        count = await this.client!.incr(counterKey);
        if (count === 1) await this.client!.expire(counterKey, windowSeconds);
      } catch {
        count = this.incrementMemoryCounter(counterKey, windowSeconds);
      }
    } else {
      count = this.incrementMemoryCounter(counterKey, windowSeconds);
    }

    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }

  private incrementMemoryCounter(key: string, windowSeconds: number): number {
    const existing = this.memory.get(key);
    const now = Date.now();
    const next =
      existing && existing.expiresAt > now ? String(Number(existing.value) + 1) : '1';
    this.memory.set(key, {
      value: next,
      expiresAt: existing && existing.expiresAt > now ? existing.expiresAt : now + windowSeconds * 1000,
    });
    return Number(next);
  }

  private async readRaw(key: string): Promise<string | null> {
    if (this.isLive()) {
      try {
        const hit = await this.client!.get(key);
        if (hit !== null) return hit;
      } catch {
        // fall through to memory
      }
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private isLive() {
    return this.client !== null && this.client.status === 'ready';
  }
}
