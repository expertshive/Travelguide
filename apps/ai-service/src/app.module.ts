import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { IntegrationResolverModule } from '@traveler-guide/integrations';
import { AiDbAdminModule } from './admin/db-admin.module';
import { AssistantModule } from './assistant/assistant.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    IntegrationResolverModule,
    RabbitmqModule,
    PrismaModule,
    AssistantModule,
    AiDbAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
