import type { ConfigService } from '@nestjs/config';

/**
 * ConfigService stand-in that reads only the values it is given.
 *
 * The real ConfigService falls back to `process.env`, which would let a
 * developer's local REDIS_URL or MAPBOX_ACCESS_TOKEN leak into a test run and
 * make results differ between machines and CI.
 */
export const mockConfig = (values: Record<string, string> = {}) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing configuration key: ${key}`);
      return value;
    },
  }) as unknown as ConfigService;
