import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createLogger } from '@traveler-guide/logger';
import {
  INTEGRATION_CATALOG,
  decryptSecret,
  encryptSecret,
  findIntegration,
  isEncryptionConfigured,
  previewSecret,
  runIntegrationProbe,
  type IntegrationDefinition,
  type IntegrationFieldStatus,
  type IntegrationStatus,
  type IntegrationTestResult,
} from '@traveler-guide/integrations';
import { PrismaService } from '../prisma/prisma.service';

type StoredSetting = {
  key: string;
  value: string;
  isSecret: boolean;
  updatedBy: string | null;
  updatedAt: Date;
};

/**
 * Owns the third-party credential registry.
 *
 * Values live here rather than only in each service's `.env` so they can be
 * rotated from the admin portal without a deploy. Consuming services read them
 * through the internal endpoint, and always keep their environment variable as a
 * fallback so nothing breaks if this service is unreachable.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = createLogger('IntegrationsService');

  constructor(private readonly prisma: PrismaService) {}

  encryptionReady(): boolean {
    return isEncryptionConfigured();
  }

  async list(): Promise<IntegrationStatus[]> {
    const [settings, providers] = await Promise.all([
      this.prisma.integrationSetting.findMany(),
      this.prisma.integrationProvider.findMany(),
    ]);

    const byProvider = new Map<string, StoredSetting[]>();
    for (const row of settings) {
      const bucket = byProvider.get(row.provider) ?? [];
      bucket.push(row);
      byProvider.set(row.provider, bucket);
    }
    const enabledByProvider = new Map(providers.map((row) => [row.provider, row.enabled]));

    return INTEGRATION_CATALOG.map((definition) =>
      this.toStatus(
        definition,
        byProvider.get(definition.provider) ?? [],
        enabledByProvider.get(definition.provider) ?? true,
      ),
    );
  }

  async get(provider: string): Promise<IntegrationStatus> {
    const definition = this.require(provider);
    const [settings, state] = await Promise.all([
      this.prisma.integrationSetting.findMany({ where: { provider } }),
      this.prisma.integrationProvider.findUnique({ where: { provider } }),
    ]);
    return this.toStatus(definition, settings, state?.enabled ?? true);
  }

  /**
   * Writes the supplied fields. A field omitted from `values` is left alone, so
   * saving a form that shows a masked secret does not wipe it; an explicitly
   * empty string clears the stored value and hands control back to the
   * environment variable.
   */
  async update(
    provider: string,
    values: Record<string, string>,
    actorId: string,
  ): Promise<IntegrationStatus> {
    const definition = this.require(provider);

    const unknown = Object.keys(values).filter(
      (key) => !definition.fields.some((field) => field.key === key),
    );
    if (unknown.length) {
      throw new BadRequestException(`Not part of ${definition.label}: ${unknown.join(', ')}`);
    }

    for (const [key, raw] of Object.entries(values)) {
      const field = definition.fields.find((candidate) => candidate.key === key);
      if (!field) continue;
      const value = raw.trim();

      if (!value) {
        await this.prisma.integrationSetting.deleteMany({ where: { provider, key } });
        continue;
      }

      if (field.secret && !this.encryptionReady()) {
        throw new BadRequestException(
          'SETTINGS_ENCRYPTION_KEY is not configured, so secrets cannot be stored.',
        );
      }

      const stored = field.secret ? encryptSecret(value) : value;
      await this.prisma.integrationSetting.upsert({
        where: { provider_key: { provider, key } },
        create: { provider, key, value: stored, isSecret: field.secret, updatedBy: actorId },
        update: { value: stored, isSecret: field.secret, updatedBy: actorId },
      });
    }

    this.logger.info('Integration credentials updated', {
      provider,
      fields: Object.keys(values),
      actorId,
    });
    return this.get(provider);
  }

  async setEnabled(provider: string, enabled: boolean, actorId: string): Promise<IntegrationStatus> {
    this.require(provider);
    await this.prisma.integrationProvider.upsert({
      where: { provider },
      create: { provider, enabled, updatedBy: actorId },
      update: { enabled, updatedBy: actorId },
    });
    return this.get(provider);
  }

  async clear(provider: string, actorId: string): Promise<IntegrationStatus> {
    this.require(provider);
    await this.prisma.integrationSetting.deleteMany({ where: { provider } });
    this.logger.warn('Integration credentials cleared', { provider, actorId });
    return this.get(provider);
  }

  /** Runs a live call against the provider using whatever is configured now. */
  async test(provider: string): Promise<IntegrationTestResult> {
    this.require(provider);
    const values = await this.resolveValues(provider);
    return runIntegrationProbe(provider, values);
  }

  /**
   * Clear-text values for one provider, for the internal service-to-service
   * endpoint. Only ever reached with a valid internal token.
   */
  async resolveValues(provider: string): Promise<Record<string, string>> {
    const definition = this.require(provider);
    const rows = await this.prisma.integrationSetting.findMany({ where: { provider } });
    const values: Record<string, string> = {};

    for (const field of definition.fields) {
      const row = rows.find((candidate) => candidate.key === field.key);
      const stored = row ? this.readValue(row) : null;
      const value = stored ?? process.env[field.key] ?? '';
      if (value) values[field.key] = value;
    }
    return values;
  }

  // -- helpers ---------------------------------------------------------------

  private require(provider: string): IntegrationDefinition {
    const definition = findIntegration(provider);
    if (!definition) throw new NotFoundException(`Unknown integration: ${provider}`);
    return definition;
  }

  /** Returns null when a row cannot be decrypted, so a rotated master key
   * degrades to "not configured" rather than throwing on every read. */
  private readValue(row: Pick<StoredSetting, 'key' | 'value' | 'isSecret'>): string | null {
    if (!row.isSecret) return row.value;
    try {
      return decryptSecret(row.value);
    } catch {
      this.logger.error('Stored secret could not be decrypted', { key: row.key });
      return null;
    }
  }

  private toStatus(
    definition: IntegrationDefinition,
    rows: StoredSetting[],
    enabled: boolean,
  ): IntegrationStatus {
    const fields: IntegrationFieldStatus[] = definition.fields.map((field) => {
      const row = rows.find((candidate) => candidate.key === field.key);
      const stored = row ? this.readValue(row) : null;
      const fromEnv = process.env[field.key] || null;
      const effective = stored ?? fromEnv;

      return {
        key: field.key,
        label: field.label,
        secret: field.secret,
        required: field.required,
        placeholder: field.placeholder,
        help: field.help,
        configured: Boolean(effective),
        source: stored ? 'database' : fromEnv ? 'environment' : 'missing',
        preview: effective ? (field.secret ? previewSecret(effective) : effective) : null,
      };
    });

    const latest = rows.reduce<StoredSetting | null>(
      (newest, row) => (!newest || row.updatedAt > newest.updatedAt ? row : newest),
      null,
    );

    const required = fields.filter((field) => field.required);
    return {
      ...definition,
      // Replaces the catalog's plain field list with the status-bearing version.
      fields,
      enabled,
      // Where every field is optional, "all required fields are present" would be
      // vacuously true and an entirely unconfigured integration would report
      // itself ready, so at least one value has to be set.
      ready:
        Boolean(definition.keyless) ||
        (required.length > 0
          ? required.every((field) => field.configured)
          : fields.some((field) => field.configured)),
      updatedAt: latest?.updatedAt.toISOString() ?? null,
      updatedBy: latest?.updatedBy ?? null,
    };
  }
}
