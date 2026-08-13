import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { UsersDbAdminModule } from './admin/db-admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    RabbitmqModule,
    PrismaModule,
    AuthModule,
    ProfileModule,
    UsersDbAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
