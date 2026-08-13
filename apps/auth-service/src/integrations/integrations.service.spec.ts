import { BadRequestException, NotFoundException } from '@nestjs/common';
import { decryptSecret } from '@traveler-guide/integrations';
import type { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from './integrations.service';

type SettingRow = {
  provider: string;
  key: string;
  value: string;
  isSecret: boolean;
  updatedBy: string | null;
  updatedAt: Date;
};

/**
 * In-memory stand-in for the two tables the service touches. Enough of Prisma's
 * shape to exercise the storage rules without a database.
 */
const buildPrismaStub = (seed: SettingRow[] = []) => {
  const settings = [...seed];
  const providers: { provider: string; enabled: boolean }[] = [];

  return {
    rows: settings,
    prisma: {
      integrationSetting: {
        findMany: ({ where }: { where?: { provider?: string } } = {}) =>
          Promise.resolve(
            where?.provider ? settings.filter((r) => r.provider === where.provider) : settings,
          ),
        deleteMany: ({ where }: { where: { provider: string; key?: string } }) => {
          for (let i = settings.length - 1; i >= 0; i -= 1) {
            const row = settings[i];
            if (row.provider !== where.provider) continue;
            if (where.key && row.key !== where.key) continue;
            settings.splice(i, 1);
          }
          return Promise.resolve({ count: 0 });
        },
        upsert: ({
          where,
          create,
          update,
        }: {
          where: { provider_key: { provider: string; key: string } };
          create: SettingRow;
          update: Partial<SettingRow>;
        }) => {
          const { provider, key } = where.provider_key;
          const existing = settings.find((r) => r.provider === provider && r.key === key);
          if (existing) Object.assign(existing, update, { updatedAt: new Date() });
          else settings.push({ ...create, updatedAt: new Date() });
          return Promise.resolve(existing ?? settings[settings.length - 1]);
        },
      },
      integrationProvider: {
        findMany: () => Promise.resolve(providers),
        findUnique: ({ where }: { where: { provider: string } }) =>
          Promise.resolve(providers.find((p) => p.provider === where.provider) ?? null),
        upsert: ({
          where,
          create,
        }: {
          where: { provider: string };
          create: { provider: string; enabled: boolean };
        }) => {
          const existing = providers.find((p) => p.provider === where.provider);
          if (existing) existing.enabled = create.enabled;
          else providers.push(create);
          return Promise.resolve(create);
        },
      },
    } as unknown as PrismaService,
  };
};

const KEY = 'c'.repeat(64);
const ACTOR = 'admin-1';

describe('IntegrationsService', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    const before = { ...process.env };
    process.env.SETTINGS_ENCRYPTION_KEY = KEY;
    // Cleared so a developer's real keys cannot make these assertions pass.
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.MAPBOX_PUBLIC_TOKEN;
    restoreEnv = () => {
      process.env = before;
    };
  });

  afterEach(() => restoreEnv());

  describe('update', () => {
    it('encrypts a secret before it reaches the database', async () => {
      const { prisma, rows } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      await service.update('google_maps', { GOOGLE_MAPS_API_KEY: 'AIzaSyPlain' }, ACTOR);

      expect(rows).toHaveLength(1);
      expect(rows[0].value).not.toContain('AIzaSyPlain');
      expect(rows[0].isSecret).toBe(true);
      expect(decryptSecret(rows[0].value)).toBe('AIzaSyPlain');
    });

    it('stores a non-secret setting as plain text, so it stays readable', async () => {
      const { prisma, rows } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      await service.update('gemini', { GEMINI_MODEL: 'gemini-2.0-flash' }, ACTOR);

      expect(rows[0]).toMatchObject({ key: 'GEMINI_MODEL', value: 'gemini-2.0-flash', isSecret: false });
    });

    it('never returns the stored secret, only a preview of it', async () => {
      const { prisma } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      const status = await service.update(
        'google_maps',
        { GOOGLE_MAPS_API_KEY: 'AIzaSyABCDEFGHIJKLMNOP123' },
        ACTOR,
      );

      expect(JSON.stringify(status)).not.toContain('AIzaSyABCDEFGHIJKLMNOP123');
      expect(status.fields[0].preview).toBe('AIzaSy…123');
      expect(status.fields[0].source).toBe('database');
    });

    it('leaves an omitted field untouched, so a masked form does not wipe it', async () => {
      const { prisma, rows } = buildPrismaStub();
      const service = new IntegrationsService(prisma);
      await service.update('mapbox', { MAPBOX_ACCESS_TOKEN: 'sk.keep-me' }, ACTOR);

      await service.update('mapbox', { MAPBOX_PUBLIC_TOKEN: 'pk.new' }, ACTOR);

      expect(rows).toHaveLength(2);
      const secret = rows.find((r) => r.key === 'MAPBOX_ACCESS_TOKEN');
      expect(decryptSecret(secret!.value)).toBe('sk.keep-me');
    });

    it('treats an empty string as "clear this and fall back to the environment"', async () => {
      const { prisma, rows } = buildPrismaStub();
      const service = new IntegrationsService(prisma);
      await service.update('google_maps', { GOOGLE_MAPS_API_KEY: 'AIzaSyStored' }, ACTOR);

      process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyFromEnvironment';
      const status = await service.update('google_maps', { GOOGLE_MAPS_API_KEY: '' }, ACTOR);

      expect(rows).toHaveLength(0);
      expect(status.fields[0].source).toBe('environment');
      expect(status.fields[0].configured).toBe(true);
    });

    it('rejects a field that is not part of the integration', async () => {
      const { prisma } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      await expect(
        service.update('google_maps', { SOME_OTHER_SECRET: 'nope' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to store a secret when no master key is configured', async () => {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
      const { prisma, rows } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      await expect(
        service.update('google_maps', { GOOGLE_MAPS_API_KEY: 'AIzaSy' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
      expect(rows).toHaveLength(0);
    });

    it('rejects an unknown provider', async () => {
      const { prisma } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      await expect(service.update('not-a-provider', {}, ACTOR)).rejects.toThrow(NotFoundException);
    });
  });

  describe('status reporting', () => {
    it('prefers a stored value over the environment', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyFromEnvironment';
      const { prisma } = buildPrismaStub();
      const service = new IntegrationsService(prisma);
      await service.update('google_maps', { GOOGLE_MAPS_API_KEY: 'AIzaSyFromDatabase' }, ACTOR);

      const values = await service.resolveValues('google_maps');

      expect(values.GOOGLE_MAPS_API_KEY).toBe('AIzaSyFromDatabase');
    });

    it('falls back to the environment when nothing is stored', async () => {
      process.env.GEMINI_API_KEY = 'from-env';
      const { prisma } = buildPrismaStub();

      const values = await new IntegrationsService(prisma).resolveValues('gemini');

      expect(values.GEMINI_API_KEY).toBe('from-env');
    });

    it('reports an integration with no values at all as missing and not ready', async () => {
      const { prisma } = buildPrismaStub();

      const status = await new IntegrationsService(prisma).get('mapbox');

      expect(status.ready).toBe(false);
      expect(status.fields.map((f) => f.source)).toEqual(['missing', 'missing']);
      expect(status.fields.every((f) => f.preview === null)).toBe(true);
    });

    it('treats a keyless integration as ready without any credentials', async () => {
      const { prisma } = buildPrismaStub();

      const status = await new IntegrationsService(prisma).get('open_meteo');

      expect(status.fields).toHaveLength(0);
      expect(status.ready).toBe(true);
    });

    it('does not call an all-optional integration ready until something is set', async () => {
      const { prisma } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      expect((await service.get('google_maps_mobile')).ready).toBe(false);

      await service.update('google_maps_mobile', { MOBILE_IOS_GOOGLE_MAPS_API_KEY: 'AIza-ios' }, ACTOR);

      expect((await service.get('google_maps_mobile')).ready).toBe(true);
    });

    it('degrades an undecryptable row to "not configured" instead of throwing', async () => {
      const { prisma } = buildPrismaStub([
        {
          provider: 'google_maps',
          key: 'GOOGLE_MAPS_API_KEY',
          value: 'v1:aaaa:bbbb:cccc', // written under a key we no longer hold
          isSecret: true,
          updatedBy: ACTOR,
          updatedAt: new Date(),
        },
      ]);

      const status = await new IntegrationsService(prisma).get('google_maps');

      expect(status.fields[0].configured).toBe(false);
      expect(status.fields[0].source).toBe('missing');
    });

    it('lists the whole catalogue even when nothing has been configured', async () => {
      const { prisma } = buildPrismaStub();

      const all = await new IntegrationsService(prisma).list();

      expect(all.map((i) => i.provider)).toEqual([
        'google_maps',
        'mapbox',
        'gemini',
        'open_meteo',
        'google_maps_mobile',
      ]);
    });
  });

  describe('enable/disable', () => {
    it('records a provider being switched off', async () => {
      const { prisma } = buildPrismaStub();
      const service = new IntegrationsService(prisma);

      expect((await service.get('gemini')).enabled).toBe(true);
      await service.setEnabled('gemini', false, ACTOR);
      expect((await service.get('gemini')).enabled).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes every stored field for the provider', async () => {
      const { prisma, rows } = buildPrismaStub();
      const service = new IntegrationsService(prisma);
      await service.update(
        'mapbox',
        { MAPBOX_ACCESS_TOKEN: 'sk.a', MAPBOX_PUBLIC_TOKEN: 'pk.b' },
        ACTOR,
      );
      expect(rows).toHaveLength(2);

      const status = await service.clear('mapbox', ACTOR);

      expect(rows).toHaveLength(0);
      expect(status.fields.every((f) => f.source === 'missing')).toBe(true);
    });
  });
});
