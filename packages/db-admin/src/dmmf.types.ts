/**
 * Structural mirror of the slice of Prisma's DMMF this package reads.
 *
 * Every service generates its own Prisma client, so `Prisma.dmmf` has a
 * different nominal type in each one. Describing the shape structurally lets a
 * single package serve all of them: a service passes its own
 * `Prisma.dmmf.datamodel.models` straight in and TypeScript accepts it.
 */
export interface DmmfField {
  name: string;
  kind: string;
  type: string;
  isId?: boolean;
  isList?: boolean;
  isRequired?: boolean;
  isUpdatedAt?: boolean;
  isReadOnly?: boolean;
  hasDefaultValue?: boolean;
}

export interface DmmfModel {
  name: string;
  dbName?: string | null;
  fields: readonly DmmfField[];
  primaryKey?: { name?: string | null; fields: readonly string[] } | null;
}

/** The subset of a Prisma model delegate the generic editor calls. */
export interface PrismaDelegate {
  findMany(args?: unknown): Promise<Record<string, unknown>[]>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
  delete(args: unknown): Promise<unknown>;
}

/**
 * A Prisma client seen as a bag of delegates keyed by accessor. The concrete
 * client type is service-specific, so it is reached through this index type.
 */
export type PrismaClientLike = Record<string, unknown>;
