/**
 * App configuration flags.
 *
 * Map provider selection. The Google Maps SDK on iOS THROWS if a map view is
 * created without a valid API key (GMSServicesException), so we cannot use the
 * Google provider until a key is supplied. Until then the Map screen falls back
 * to the platform's default provider — Apple Maps on iOS, which needs no key and
 * renders a real, interactive map. All markers, routes and navigation work the
 * same on either provider.
 *
 * To switch to Google Maps once you have a key (see apps/mobile/README.md):
 *   1. Add your key:
 *      - Android: android/gradle.properties  → GOOGLE_MAPS_API_KEY=...
 *      - iOS:     Info.plist GMSApiKey / GOOGLE_MAPS_API_KEY build setting
 *   2. Set GOOGLE_MAPS_ENABLED to true below and rebuild.
 *
 * Note: on Android the default provider IS Google Maps, so the Android map also
 * needs a key to render tiles; iOS works key-less via Apple Maps.
 */
export const GOOGLE_MAPS_ENABLED = true;
