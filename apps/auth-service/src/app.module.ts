import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { AuthDbAdminModule } from './admin/db-admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TerminusModule,
    RabbitmqModule,
    PrismaModule,
    AuthModule,
    AuthDbAdminModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
