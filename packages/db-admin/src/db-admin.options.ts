import type { ModuleMetadata, Type } from '@nestjs/common';
import type { DmmfModel, PrismaClientLike } from './dmmf.types';

export const DB_ADMIN_OPTIONS = Symbol('DB_ADMIN_OPTIONS');

export interface DeleteGuardContext {
  /** Prisma client accessor for the table, e.g. `user`. */
  accessor: string;
  /** Prisma model name, e.g. `User`. */
  model: string;
  /** Primary-key values identifying the row about to be deleted. */
  where: Record<string, string>;
  /** The admin performing the delete, taken from their access token. */
  currentUserId: string;
  prisma: PrismaClientLike;
}

/**
 * Refuses a delete by throwing. Services register these to protect rows whose
 * removal would break the system — the last super admin, for instance.
 */
export type DeleteGuard = (context: DeleteGuardContext) => void | Promise<void>;

export interface DbAdminOptions {
  /**
   * Route segment this service is reached by at the gateway, e.g. `auth`
   * produces `/v1/auth/admin/db/...`. Must match the gateway's SERVICE_ROUTES
   * entry so the admin portal can find it.
   */
  segment: string;
  /** Human label for the service, shown as a sidebar group in the admin. */
  label: string;
  /** Pass `Prisma.dmmf.datamodel.models` from the service's generated client. */
  models: readonly DmmfModel[];
  /** Injection token for the service's Prisma client (usually PrismaService). */
  prisma: Type<unknown> | string | symbol;
  /** Modules providing `prisma`, when it is not exported by a global module. */
  imports?: ModuleMetadata['imports'];
  /** Row-level delete protections. */
  guards?: DeleteGuard[];
}
