/**
 * App configuration flags.
 *
 * Map provider selection. The Google Maps SDK on iOS THROWS if a map view is
 * created without a valid API key (GMSServicesException), so we cannot use the
 * Google provider until a key is supplied. Until then:
 *   - iOS uses Apple Maps (no key).
 *   - Android overlays OpenStreetMap tiles (the default provider is still
 *     Google Maps, which renders a blank map without a key).
 *
 * To switch to Google Maps once you have a key (see apps/mobile/README.md):
 *   1. Add your key:
 *      - Android: android/gradle.properties  → GOOGLE_MAPS_API_KEY=...
 *      - iOS:     Info.plist GMSApiKey / GOOGLE_MAPS_API_KEY build setting
 *   2. Set GOOGLE_MAPS_ENABLED to true below and rebuild.
 */
export const GOOGLE_MAPS_ENABLED = true;

/** Raster tiles used on Android when GOOGLE_MAPS_ENABLED is false. */
export const OSM_STREET_TILES =
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';
export const OSM_SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
