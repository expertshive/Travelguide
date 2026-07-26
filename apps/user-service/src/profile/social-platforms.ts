export const SOCIAL_PLATFORMS = [
  'instagram',
  'twitter',
  'facebook',
  'linkedin',
  'youtube',
  'tiktok',
  'snapchat',
  'website',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
