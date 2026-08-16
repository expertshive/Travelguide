import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { GatewayAdminModule } from './admin/admin.module';
import { GatewayAuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TerminusModule,
    RabbitmqModule,
    GatewayAuthModule,
    GatewayAdminModule,
    ProxyModule,
    WebsocketModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
