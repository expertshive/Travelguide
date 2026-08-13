import { Module, type DynamicModule } from '@nestjs/common';
import { createDbAdminController } from './db-admin.controller';
import { DB_ADMIN_OPTIONS, type DbAdminOptions } from './db-admin.options';
import { DbAdminService } from './db-admin.service';
import type { PrismaClientLike } from './dmmf.types';

/**
 * Exposes `/<segment>/admin/db/*` for one service.
 *
 * A service registers it with its own Prisma client and DMMF:
 *
 * ```ts
 * DbAdminModule.forRoot({
 *   segment: 'trips',
 *   label: 'Trips',
 *   models: Prisma.dmmf.datamodel.models,
 *   prisma: PrismaService,
 * })
 * ```
 */
@Module({})
export class DbAdminModule {
  static forRoot(options: DbAdminOptions): DynamicModule {
    return {
      module: DbAdminModule,
      imports: options.imports ?? [],
      controllers: [createDbAdminController(options)],
      providers: [
        { provide: DB_ADMIN_OPTIONS, useValue: options },
        {
          provide: DbAdminService,
          useFactory: (prisma: PrismaClientLike) => new DbAdminService(prisma, options),
          inject: [options.prisma],
        },
      ],
      exports: [DbAdminService],
    };
  }
}
