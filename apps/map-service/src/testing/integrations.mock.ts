import type { IntegrationResolver } from '@traveler-guide/integrations';

/**
 * IntegrationResolver stand-in that serves only the values it is given.
 *
 * The real resolver calls auth-service and falls back to `process.env`, either
 * of which would make a test depend on the machine it runs on. This keeps
 * credentials explicit per test, matching `mockConfig`.
 */
export const mockIntegrations = (values: Record<string, string> = {}) =>
  ({
    get: (_provider: string, key: string) => Promise.resolve(values[key]),
    getOr: (_provider: string, key: string, fallback: string) =>
      Promise.resolve(values[key] ?? fallback),
    peek: (_provider: string, key: string) => values[key],
    prime: () => Promise.resolve(),
    invalidate: () => undefined,
  }) as unknown as IntegrationResolver;
