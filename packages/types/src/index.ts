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

export interface UpdateRoleRequest {
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

// ---------------------------------------------------------------------------
// Dynamic database admin (introspected from the service's Prisma schema)
// ---------------------------------------------------------------------------

export type DbFieldKind = 'scalar' | 'enum' | 'object';

export interface DbColumnMeta {
  /** Prisma field name (camelCase). */
  name: string;
  /** Prisma scalar/enum type name, e.g. String, Boolean, DateTime. */
  type: string;
  kind: DbFieldKind;
  isId: boolean;
  isRequired: boolean;
  isList: boolean;
  isPrimaryKey: boolean;
  /** True when the field can be changed through the generic editor. */
  editable: boolean;
  /** True for password hashes, tokens, OTPs — value is masked in responses. */
  sensitive: boolean;
}

export interface DbTableMeta {
  /** Prisma model name, e.g. User. */
  model: string;
  /** Prisma client accessor, e.g. user. Used as the route/id for the table. */
  accessor: string;
  /** Physical table name, e.g. users. */
  dbName: string;
  /** Humanised label for menus and headers, e.g. Users. */
  label: string;
  /** Primary-key field names (one, or several for composite keys). */
  primaryKey: string[];
  fields: DbColumnMeta[];
  /** Row count, best-effort. */
  count: number;
  /** True when every required field is editable, so a row can be created. */
  creatable: boolean;
}

export interface DbRowsResult {
  model: string;
  accessor: string;
  label: string;
  primaryKey: string[];
  fields: DbColumnMeta[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  creatable: boolean;
}

export interface MutateDbRowRequest {
  /** Primary-key values identifying the row. */
  where: Record<string, string>;
  /** Editable field values to write. */
  data: Record<string, unknown>;
}

export interface CreateDbRowRequest {
  data: Record<string, unknown>;
}

export interface DeleteDbRowRequest {
  where: Record<string, string>;
}

/** One service as reported by the gateway's `/v1/admin/services` catalog. */
export interface ServiceCatalogEntry {
  /** Path segment the service is reached by, e.g. `auth`. */
  segment: string;
  label: string;
  /** False when the service did not answer — its tables are then empty. */
  online: boolean;
  tables: DbTableMeta[];
  /** Populated when the service answered with an error. */
  error?: string;
}

// -- Third-party integrations -------------------------------------------------

/** One configurable value belonging to an integration, e.g. an API key. */
export interface IntegrationField {
  /** Environment variable name, which doubles as the storage key. */
  key: string;
  label: string;
  /** Secrets are encrypted at rest and never returned in clear text. */
  secret: boolean;
  required: boolean;
  placeholder?: string;
  help?: string;
}

/**
 * Where a value has to be present to take effect.
 *
 * `server` values are read at request time, so saving one takes effect within
 * the resolver's cache window. `clientBuild` values are compiled into the mobile
 * app, so saving one records intent but needs an app rebuild.
 */
export type IntegrationScope = 'server' | 'clientBuild';

export interface IntegrationDefinition {
  /** Stable identifier used in routes, e.g. `google_maps`. */
  provider: string;
  label: string;
  vendor: string;
  description: string;
  /** Services that consume this integration. */
  usedBy: string[];
  docsUrl: string;
  /** Where to get credentials. */
  consoleUrl?: string;
  scope: IntegrationScope;
  fields: IntegrationField[];
  /** True when the value can be validated with a live call. */
  testable: boolean;
  /** Set when the integration works without credentials. */
  keyless?: boolean;
}

/** Where a resolved value came from. */
export type IntegrationSource = 'database' | 'environment' | 'missing';

export interface IntegrationFieldStatus extends IntegrationField {
  configured: boolean;
  source: IntegrationSource;
  /** Safe hint for secrets, e.g. `AIzaSy…6Hk`; full value for non-secrets. */
  preview: string | null;
}

export interface IntegrationStatus extends Omit<IntegrationDefinition, 'fields'> {
  fields: IntegrationFieldStatus[];
  /** False when an admin has switched the integration off. */
  enabled: boolean;
  /** True when every required field has a value. */
  ready: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface IntegrationsOverview {
  /** False when SETTINGS_ENCRYPTION_KEY is missing, so secrets cannot be saved. */
  encryptionReady: boolean;
  integrations: IntegrationStatus[];
}

export interface IntegrationTestResult {
  provider: string;
  ok: boolean;
  message: string;
  /** Round-trip time of the live probe. */
  durationMs: number;
  checkedAt: string;
}
