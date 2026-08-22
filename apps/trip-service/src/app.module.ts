import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { TripsDbAdminModule } from './admin/db-admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TerminusModule,
    RabbitmqModule,
    PrismaModule,
    AuthModule,
    TripsModule,
    TripsDbAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
