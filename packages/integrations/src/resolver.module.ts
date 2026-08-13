import { Global, Module } from '@nestjs/common';
import { IntegrationResolver } from './resolver';

/**
 * Global so any provider in a consuming service can inject the resolver without
 * each feature module re-importing it.
 */
@Global()
@Module({
  providers: [IntegrationResolver],
  exports: [IntegrationResolver],
})
export class IntegrationResolverModule {}
