import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  type Type,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateRowDto, DeleteRowDto, UpdateRowDto } from './db-admin.dto';
import { DbAdminGuard, DbAdminUser, type DbAdminActor } from './db-admin.guard';
import type { DbAdminOptions } from './db-admin.options';
import { DbAdminService } from './db-admin.service';

/**
 * Builds the table-admin controller for one service.
 *
 * The route prefix has to vary per service (`auth/admin/db`, `map/admin/db`,
 * and so on) but `@Controller()` takes a literal, so the class is generated
 * here with the segment baked in rather than written out thirteen times.
 */
export function createDbAdminController(options: DbAdminOptions): Type<unknown> {
  @ApiTags('DB Admin')
  @ApiBearerAuth()
  @UseGuards(DbAdminGuard)
  @Controller(`${options.segment}/admin/db`)
  class GeneratedDbAdminController {
    constructor(@Inject(DbAdminService) private readonly db: DbAdminService) {}

    @Get('meta')
    @ApiOperation({ summary: 'Describe this service so the admin can group its tables' })
    meta() {
      return {
        segment: options.segment,
        label: options.label,
        tableCount: options.models.length,
      };
    }

    @Get('tables')
    @ApiOperation({ summary: 'List every table with its column metadata' })
    tables() {
      return this.db.listTables();
    }

    @Get('tables/:model')
    @ApiOperation({ summary: 'Read a page of rows from a table' })
    rows(
      @Param('model') model: string,
      @Query('page') page?: string,
      @Query('pageSize') pageSize?: string,
      @Query('search') search?: string,
    ) {
      return this.db.getRows(model, {
        page: page ? Number.parseInt(page, 10) : undefined,
        pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
        search,
      });
    }

    @Post('tables/:model')
    @ApiOperation({ summary: 'Create a row' })
    create(@Param('model') model: string, @Body() dto: CreateRowDto) {
      return this.db.createRow(model, dto.data);
    }

    @Patch('tables/:model')
    @ApiOperation({ summary: 'Update a row by its primary key' })
    update(@Param('model') model: string, @Body() dto: UpdateRowDto) {
      return this.db.updateRow(model, dto.where, dto.data);
    }

    @Delete('tables/:model')
    @ApiOperation({ summary: 'Delete a row by its primary key' })
    remove(
      @Param('model') model: string,
      @Body() dto: DeleteRowDto,
      @DbAdminUser() actor: DbAdminActor,
    ) {
      return this.db.deleteRow(model, dto.where, actor.userId);
    }
  }

  // Nest and Swagger both surface the class name; a per-service name keeps the
  // generated API docs readable.
  const name = `${options.segment.charAt(0).toUpperCase()}${options.segment.slice(1)}DbAdminController`;
  Object.defineProperty(GeneratedDbAdminController, 'name', { value: name });
  return GeneratedDbAdminController;
}
