import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DbColumnMeta, DbRowsResult, DbTableMeta } from '@traveler-guide/types';
import type { DmmfModel, PrismaClientLike, PrismaDelegate } from './dmmf.types';
import type { DbAdminOptions } from './db-admin.options';

/** Field names whose values must never leave the service in clear text. */
const SENSITIVE = /(password|token|secret|otp|apikey|api_key)/i;
const MASK = '••••••';
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

/**
 * Generic, schema-driven access to every table in one service's database.
 *
 * Table and column metadata come from Prisma's DMMF, so any model added to a
 * `schema.prisma` becomes manageable from the admin portal with no per-table
 * code. The same class serves every service; the models, the Prisma client and
 * any delete protections are supplied per service through {@link DbAdminOptions}.
 */
@Injectable()
export class DbAdminService {
  private readonly models: readonly DmmfModel[];

  constructor(
    private readonly prisma: PrismaClientLike,
    private readonly options: DbAdminOptions,
  ) {
    this.models = options.models;
  }

  listTables(): Promise<DbTableMeta[]> {
    return Promise.all(this.models.map((model) => this.describe(model)));
  }

  async getRows(
    name: string,
    opts: { page?: number; pageSize?: number; search?: string },
  ): Promise<DbRowsResult> {
    const model = this.findModel(name);
    const fields = this.columns(model);
    const pageSize = Math.min(Math.max(opts.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(opts.page ?? 1, 1);
    const where = this.buildSearch(fields, opts.search);
    const delegate = this.delegate(model);

    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: this.orderBy(model),
      }),
      delegate.count({ where }),
    ]);

    return {
      model: model.name,
      accessor: this.accessor(model),
      label: this.label(model),
      primaryKey: this.pkFields(model),
      fields,
      rows: rows.map((row) => this.mask(fields, row)),
      total,
      page,
      pageSize,
      creatable: this.isCreatable(model, fields),
    };
  }

  async createRow(name: string, data: Record<string, unknown>) {
    const model = this.findModel(name);
    const fields = this.columns(model);
    const payload = this.coerce(fields, data);
    if (!Object.keys(payload).length) {
      throw new BadRequestException('No values provided.');
    }
    const created = await this.delegate(model).create({ data: payload });
    return this.mask(fields, created);
  }

  async updateRow(name: string, where: Record<string, string>, data: Record<string, unknown>) {
    const model = this.findModel(name);
    const fields = this.columns(model);
    const patch = this.coerce(fields, data);
    if (!Object.keys(patch).length) {
      throw new BadRequestException('No editable fields were provided.');
    }
    const updated = await this.delegate(model).update({
      where: this.buildWhere(model, where),
      data: patch,
    });
    return this.mask(fields, updated);
  }

  async deleteRow(name: string, where: Record<string, string>, currentUserId: string) {
    const model = this.findModel(name);
    const accessor = this.accessor(model);

    for (const guard of this.options.guards ?? []) {
      await guard({ accessor, model: model.name, where, currentUserId, prisma: this.prisma });
    }

    await this.delegate(model).delete({ where: this.buildWhere(model, where) });
    return { success: true };
  }

  // -- introspection helpers -------------------------------------------------

  private async describe(model: DmmfModel): Promise<DbTableMeta> {
    const fields = this.columns(model);
    let count = 0;
    try {
      count = await this.delegate(model).count();
    } catch {
      // A table the migration has not created yet should not blank the sidebar.
      count = 0;
    }
    return {
      model: model.name,
      accessor: this.accessor(model),
      dbName: model.dbName ?? model.name,
      label: this.label(model),
      primaryKey: this.pkFields(model),
      fields,
      count,
      creatable: this.isCreatable(model, fields),
    };
  }

  private columns(model: DmmfModel): DbColumnMeta[] {
    const pk = this.pkFields(model);
    return model.fields
      .filter((field) => field.kind !== 'object') // drop relation navigation props
      .map((field) => {
        const sensitive = SENSITIVE.test(field.name);
        const isPrimaryKey = pk.includes(field.name);
        const auto =
          field.isId ||
          field.isUpdatedAt ||
          field.name === 'createdAt' ||
          field.isReadOnly; // relation foreign-key scalars
        const editable =
          field.kind === 'scalar' && !field.isList && !isPrimaryKey && !sensitive && !auto;
        return {
          name: field.name,
          type: String(field.type),
          kind: field.kind as DbColumnMeta['kind'],
          isId: Boolean(field.isId),
          isRequired: Boolean(field.isRequired),
          isList: Boolean(field.isList),
          isPrimaryKey,
          editable,
          sensitive,
        };
      });
  }

  private isCreatable(model: DmmfModel, fields: DbColumnMeta[]): boolean {
    // A row can be created generically only if the editor can supply a value
    // for every required column that has no default — and there is at least one
    // editable column to fill in, which rules out FK-only join tables.
    if (!fields.some((field) => field.editable)) return false;
    const required = model.fields.filter(
      (field) =>
        field.kind === 'scalar' &&
        !field.isList &&
        field.isRequired &&
        !field.hasDefaultValue &&
        !field.isId &&
        !field.isUpdatedAt &&
        !field.isReadOnly,
    );
    return required.every((field) => fields.find((c) => c.name === field.name)?.editable);
  }

  private pkFields(model: DmmfModel): string[] {
    if (model.primaryKey?.fields?.length) return [...model.primaryKey.fields];
    const id = model.fields.find((field) => field.isId);
    return id ? [id.name] : [];
  }

  private accessor(model: DmmfModel): string {
    return model.name.charAt(0).toLowerCase() + model.name.slice(1);
  }

  private label(model: DmmfModel): string {
    return (model.dbName ?? model.name)
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private delegate(model: DmmfModel): PrismaDelegate {
    const delegate = this.prisma[this.accessor(model)] as PrismaDelegate | undefined;
    if (!delegate?.findMany) {
      throw new NotFoundException(`No Prisma delegate for ${model.name}`);
    }
    return delegate;
  }

  private findModel(name: string): DmmfModel {
    const lower = name.toLowerCase();
    const model = this.models.find(
      (candidate) =>
        candidate.name.toLowerCase() === lower ||
        candidate.dbName?.toLowerCase() === lower ||
        this.accessor(candidate).toLowerCase() === lower,
    );
    if (!model) throw new NotFoundException(`Unknown table: ${name}`);
    return model;
  }

  private orderBy(model: DmmfModel): Record<string, 'asc' | 'desc'> | undefined {
    if (model.fields.some((field) => field.name === 'createdAt')) {
      return { createdAt: 'desc' };
    }
    const pk = this.pkFields(model);
    return pk.length ? { [pk[0]]: 'asc' } : undefined;
  }

  private buildSearch(fields: DbColumnMeta[], search?: string) {
    const term = search?.trim();
    if (!term) return undefined;
    const targets = fields.filter(
      (field) => field.type === 'String' && !field.sensitive && !field.isList,
    );
    if (!targets.length) return undefined;
    return { OR: targets.map((field) => ({ [field.name]: { contains: term } })) };
  }

  private buildWhere(model: DmmfModel, where: Record<string, string>) {
    const pk = this.pkFields(model);
    if (!pk.length) throw new BadRequestException('This table has no primary key.');
    for (const field of pk) {
      if (where?.[field] === undefined || where[field] === null) {
        throw new BadRequestException(`Missing primary-key value: ${field}`);
      }
    }
    if (pk.length === 1) return { [pk[0]]: where[pk[0]] };
    // Composite keys are addressed through Prisma's compound field.
    const compound = model.primaryKey?.name ?? pk.join('_');
    const key: Record<string, string> = {};
    for (const field of pk) key[field] = where[field];
    return { [compound]: key };
  }

  private coerce(fields: DbColumnMeta[], data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      if (!field.editable || !(field.name in data)) continue;
      const value = data[field.name];

      if (value === null || value === '') {
        if (!field.isRequired) out[field.name] = null;
        continue;
      }

      switch (field.type) {
        case 'Boolean':
          out[field.name] = typeof value === 'boolean' ? value : value === 'true';
          break;
        case 'Int':
        case 'BigInt': {
          const parsed = Number.parseInt(String(value), 10);
          if (Number.isNaN(parsed)) {
            throw new BadRequestException(`Invalid number for ${field.name}.`);
          }
          out[field.name] = parsed;
          break;
        }
        case 'Float':
        case 'Decimal': {
          const parsed = Number(value);
          if (Number.isNaN(parsed)) {
            throw new BadRequestException(`Invalid number for ${field.name}.`);
          }
          out[field.name] = parsed;
          break;
        }
        case 'DateTime': {
          const date = new Date(value as string);
          if (Number.isNaN(date.getTime())) {
            throw new BadRequestException(`Invalid date for ${field.name}.`);
          }
          out[field.name] = date;
          break;
        }
        default:
          out[field.name] = value;
      }
    }
    return out;
  }

  private mask(fields: DbColumnMeta[], row: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = { ...row };
    for (const field of fields) {
      if (field.sensitive && masked[field.name] != null) {
        masked[field.name] = MASK;
      }
    }
    return masked;
  }
}
