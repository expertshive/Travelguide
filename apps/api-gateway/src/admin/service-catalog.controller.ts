import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DbAdminGuard } from '@traveler-guide/db-admin';
import { ServiceCatalogService } from './service-catalog.service';

/**
 * `/v1/admin/*` is served by the gateway itself rather than proxied, so it sits
 * outside the middleware's admin gate and carries its own.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(DbAdminGuard)
@Controller('admin')
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get('services')
  @ApiOperation({ summary: 'Every service with its manageable tables, for the admin sidebar' })
  services(@Headers('authorization') authorization: string) {
    return this.catalog.listServices(authorization);
  }
}
