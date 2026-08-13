import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@traveler-guide/logger';
import type { DbTableMeta } from '@traveler-guide/types';
import { SERVICE_ROUTES } from '../proxy/service-routes';

export interface ServiceCatalogEntry {
  /** Path segment the service is reached by, e.g. `auth`. */
  segment: string;
  label: string;
  /** False when the service did not answer — its tables are then empty. */
  online: boolean;
  tables: DbTableMeta[];
  /** Populated when the service answered with an error. */
  error?: string;
}

const PROBE_TIMEOUT_MS = 4000;

/**
 * Builds the admin sidebar in one request.
 *
 * Asking thirteen services for their table lists from the browser would mean
 * thirteen round trips and thirteen failure states to render. The gateway
 * already knows where every service lives, so it fans out here instead and
 * reports the ones that are down as `online: false` rather than failing whole.
 */
@Injectable()
export class ServiceCatalogService {
  private readonly logger = createLogger('ServiceCatalogService');

  constructor(private readonly config: ConfigService) {}

  listServices(authorization: string): Promise<ServiceCatalogEntry[]> {
    return Promise.all(SERVICE_ROUTES.map((route) => this.describe(route, authorization)));
  }

  private async describe(
    route: (typeof SERVICE_ROUTES)[number],
    authorization: string,
  ): Promise<ServiceCatalogEntry> {
    const base = this.config.get<string>(route.envKey)?.replace(/\/$/, '');
    const entry: ServiceCatalogEntry = {
      segment: route.segment,
      label: route.label,
      online: false,
      tables: [],
    };

    if (!base) {
      return { ...entry, error: `${route.envKey} is not configured` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/v1/${route.segment}/admin/db/tables`, {
        headers: { authorization },
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ...entry, error: `Responded ${response.status}` };
      }

      // Services wrap payloads as { success, data }; tolerate a bare array too.
      const body = (await response.json()) as { data?: DbTableMeta[] } | DbTableMeta[];
      const tables = Array.isArray(body) ? body : (body.data ?? []);
      return { ...entry, online: true, tables };
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Timed out'
          : error instanceof Error
            ? error.message
            : String(error);
      this.logger.warn('Service did not report its tables', {
        segment: route.segment,
        message,
      });
      return { ...entry, error: message };
    } finally {
      clearTimeout(timer);
    }
  }
}
