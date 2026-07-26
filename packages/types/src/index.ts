export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  BUSINESS = 'business',
  GUIDE = 'guide',
  TRAVELER = 'traveler',
}

export enum Permission {
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  TRIP_READ = 'trip:read',
  TRIP_WRITE = 'trip:write',
  PLACE_READ = 'place:read',
  PLACE_WRITE = 'place:write',
  CHAT_READ = 'chat:read',
  CHAT_WRITE = 'chat:write',
  PAYMENT_READ = 'payment:read',
  PAYMENT_WRITE = 'payment:write',
  ADMIN_ACCESS = 'admin:access',
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[] | string[];
  permissions: Permission[] | string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  mobile: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SendRegisterOtpRequest {
  email: string;
  name: string;
  mobile: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyRegisterOtpRequest {
  email: string;
  otp: string;
}

export interface SendRegisterOtpResponse {
  message: string;
  otpHint?: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  otp: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
  resetUrl?: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  mobile: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

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

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export interface ProfilePhoto {
  id: string;
  url: string;
  caption: string | null;
  position: number;
  createdAt: string;
}

export interface UserProfile {
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
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface UpsertSocialLinkRequest {
  platform: string;
  url: string;
}

export interface RoleEntity {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  userCount: number;
}

export interface PermissionEntity {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
}

export interface AssignRolePermissionsRequest {
  permissions: string[];
}

export interface AssignUserRoleRequest {
  roleName: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  checks?: Record<string, { status: string }>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
