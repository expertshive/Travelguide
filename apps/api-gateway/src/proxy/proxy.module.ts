import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyMiddleware } from './proxy.middleware';

@Module({
  providers: [ProxyMiddleware],
})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProxyMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
