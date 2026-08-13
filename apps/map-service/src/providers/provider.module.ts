import { Global, Module } from '@nestjs/common';
import { GoogleProvider } from './google/google.provider';
import { MapboxProvider } from './mapbox/mapbox.provider';
import { OfflineProvider } from './offline/offline.provider';
import { ProviderRegistry } from './provider.registry';

@Global()
@Module({
  providers: [GoogleProvider, MapboxProvider, OfflineProvider, ProviderRegistry],
  exports: [ProviderRegistry, GoogleProvider, MapboxProvider, OfflineProvider],
})
export class ProviderModule {}
