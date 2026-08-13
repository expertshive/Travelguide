import { Module } from '@nestjs/common';
import { ServiceCatalogController } from './service-catalog.controller';
import { ServiceCatalogService } from './service-catalog.service';

@Module({
  controllers: [ServiceCatalogController],
  providers: [ServiceCatalogService],
})
export class GatewayAdminModule {}
