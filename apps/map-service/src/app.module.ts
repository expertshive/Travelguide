import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { IntegrationResolverModule } from '@traveler-guide/integrations';
import { MapDbAdminModule } from './admin/db-admin.module';
import { AuthModule } from './auth/auth.module';
import { GeocodeModule } from './geocode/geocode.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProviderModule } from './providers/provider.module';
import { RedisModule } from './redis/redis.module';
import { RoutesModule } from './routes/routes.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    IntegrationResolverModule,
    PrismaModule,
    RedisModule,
    ProviderModule,
    UsageModule,
    AuthModule,
    GeocodeModule,
    RoutesModule,
    MapDbAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
