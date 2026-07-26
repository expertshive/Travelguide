import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@traveler-guide/logger';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('RabbitmqService');
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) return;
    this.connected = true;
    this.logger.info('RabbitMQ configured', { url: url.replace(/:[^:@]+@/, ':***@') });
  }

  async onModuleDestroy() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}
