import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PaymentsDbAdminModule } from './admin/db-admin.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    RabbitmqModule,
    PrismaModule,
    PaymentsDbAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
