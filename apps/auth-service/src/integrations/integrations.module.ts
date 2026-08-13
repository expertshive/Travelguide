import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { InternalIntegrationsController } from './internal-integrations.controller';

@Module({
  controllers: [IntegrationsController, InternalIntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
