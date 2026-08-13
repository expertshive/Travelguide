/**
 * The one place a downstream service is declared.
 *
 * `segment` is the first path element after `/v1`, and is also the prefix each
 * service mounts its table admin under (`/v1/<segment>/admin/db`). `label` is
 * what the admin portal shows as a sidebar group.
 */
export const SERVICE_ROUTES = [
  { segment: 'auth', label: 'Auth', envKey: 'AUTH_SERVICE_URL' },
  { segment: 'users', label: 'Users', envKey: 'USER_SERVICE_URL' },
  { segment: 'trips', label: 'Trips', envKey: 'TRIP_SERVICE_URL' },
  { segment: 'places', label: 'Places', envKey: 'PLACE_SERVICE_URL' },
  { segment: 'navigation', label: 'Navigation', envKey: 'NAVIGATION_SERVICE_URL' },
  { segment: 'map', label: 'Map', envKey: 'MAP_SERVICE_URL' },
  { segment: 'social', label: 'Social', envKey: 'SOCIAL_SERVICE_URL' },
  { segment: 'chat', label: 'Chat', envKey: 'CHAT_SERVICE_URL' },
  { segment: 'notifications', label: 'Notifications', envKey: 'NOTIFICATION_SERVICE_URL' },
  { segment: 'media', label: 'Media', envKey: 'MEDIA_SERVICE_URL' },
  { segment: 'ai', label: 'AI', envKey: 'AI_SERVICE_URL' },
  { segment: 'payments', label: 'Payments', envKey: 'PAYMENT_SERVICE_URL' },
  { segment: 'business', label: 'Business', envKey: 'BUSINESS_SERVICE_URL' },
] as const;

export type ServiceRoute = (typeof SERVICE_ROUTES)[number];
