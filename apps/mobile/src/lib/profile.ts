import { API_BASE, authorizedRequest } from './auth';
import type { UpdateProfileInput, UploadableImage, UserProfile } from './types';

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

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  website: 'Website',
};

/** Stored media paths are relative to the API root, so they need the base URL to render. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}

export async function getMyProfile(): Promise<UserProfile> {
  return authorizedRequest<UserProfile>('/users/profile');
}

export async function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  return authorizedRequest<UserProfile>('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

function toFormData(image: UploadableImage, caption?: string) {
  const form = new FormData();
  form.append('file', {
    uri: image.uri,
    name: image.fileName ?? 'upload.jpg',
    type: image.type ?? 'image/jpeg',
  } as unknown as Blob);
  if (caption) form.append('caption', caption);
  return form;
}

export async function uploadAvatar(image: UploadableImage): Promise<UserProfile> {
  return authorizedRequest<UserProfile>('/users/profile/avatar', {
    method: 'POST',
    body: toFormData(image),
  });
}

export async function removeAvatar(): Promise<UserProfile> {
  return authorizedRequest<UserProfile>('/users/profile/avatar', { method: 'DELETE' });
}

export async function addPhoto(image: UploadableImage, caption?: string): Promise<UserProfile> {
  return authorizedRequest<UserProfile>('/users/profile/photos', {
    method: 'POST',
    body: toFormData(image, caption),
  });
}

export async function removePhoto(photoId: string): Promise<UserProfile> {
  return authorizedRequest<UserProfile>(`/users/profile/photos/${photoId}`, { method: 'DELETE' });
}

export async function setSocialLink(platform: string, url: string): Promise<UserProfile> {
  return authorizedRequest<UserProfile>('/users/profile/social-links', {
    method: 'PUT',
    body: JSON.stringify({ platform, url }),
  });
}

export async function removeSocialLink(platform: string): Promise<UserProfile> {
  return authorizedRequest<UserProfile>(`/users/profile/social-links/${platform}`, {
    method: 'DELETE',
  });
}
