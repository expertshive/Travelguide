export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  mobile: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
};

export type SocialLink = {
  id: string;
  platform: string;
  url: string;
};

export type ProfilePhoto = {
  id: string;
  url: string;
  caption: string | null;
  position: number;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  photos: ProfilePhoto[];
  socialLinks: SocialLink[];
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileInput = {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
};

export type UploadableImage = {
  uri: string;
  fileName?: string | null;
  type?: string | null;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};
