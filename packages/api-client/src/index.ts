import type {
  ApiResponse,
  AssignRolePermissionsRequest,
  AssignUserRoleRequest,
  AuthTokens,
  AuthUser,
  CreateRoleRequest,
  DbRowsResult,
  DbTableMeta,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  IntegrationsOverview,
  IntegrationStatus,
  IntegrationTestResult,
  LoginRequest,
  LogoutRequest,
  PaginatedResult,
  PermissionEntity,
  RefreshRequest,
  ServiceCatalogEntry,
  SendRegisterOtpRequest,
  SendRegisterOtpResponse,
  VerifyRegisterOtpRequest,
  RegisterRequest,
  ResetPasswordRequest,
  RoleEntity,
  UpdateProfileRequest,
  UpdateRoleRequest,
  UpsertSocialLinkRequest,
  UserProfile,
  UserSummary,
} from '@traveler-guide/types';

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
}

export interface TokenStorage {
  getAccessToken(): string | null | Promise<string | null>;
  getRefreshToken(): string | null | Promise<string | null>;
  setTokens(tokens: AuthTokens): void | Promise<void>;
  clearTokens(): void | Promise<void>;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    // FormData must set its own Content-Type so the multipart boundary is included.
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (!headers.has('Content-Type') && init.body && !isFormData) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.options.getToken ? await this.options.getToken() : null;
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message ?? response.statusText);
    }

    return payload.data as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  postForm<T>(path: string, form: FormData) {
    return this.request<T>(path, { method: 'POST', body: form });
  }

  delete<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
}

export function createApiClient(options: ApiClientOptions) {
  return new ApiClient(options);
}

export class AuthApi {
  private readonly client: ApiClient;

  constructor(
    baseUrl: string,
    private readonly storage: TokenStorage,
  ) {
    this.client = createApiClient({
      baseUrl,
      getToken: () => this.storage.getAccessToken(),
    });
  }

  getClient() {
    return this.client;
  }

  async login(input: LoginRequest): Promise<AuthTokens> {
    const tokens = await this.client.post<AuthTokens>('/auth/login', input);
    await this.storage.setTokens(tokens);
    return tokens;
  }

  async sendRegisterOtp(input: SendRegisterOtpRequest): Promise<SendRegisterOtpResponse> {
    return this.client.post<SendRegisterOtpResponse>('/auth/register/send-otp', input);
  }

  async verifyRegisterOtp(input: VerifyRegisterOtpRequest): Promise<AuthTokens> {
    const tokens = await this.client.post<AuthTokens>('/auth/register/verify-otp', input);
    await this.storage.setTokens(tokens);
    return tokens;
  }

  /** @deprecated Use sendRegisterOtp + verifyRegisterOtp */
  async register(input: RegisterRequest): Promise<AuthTokens> {
    await this.sendRegisterOtp({
      email: input.email,
      name: input.name,
      mobile: input.mobile,
      password: input.password,
      confirmPassword: input.confirmPassword,
    });
    return this.verifyRegisterOtp({ email: input.email, otp: input.otp });
  }

  async refresh(): Promise<AuthTokens> {
    const refreshToken = await this.storage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const tokens = await this.client.post<AuthTokens>('/auth/refresh', {
      refreshToken,
    } satisfies RefreshRequest);
    await this.storage.setTokens(tokens);
    return tokens;
  }

  async logout(input: LogoutRequest = {}): Promise<void> {
    const refreshToken = input.refreshToken ?? (await this.storage.getRefreshToken());
    try {
      if (await this.storage.getAccessToken()) {
        await this.client.post<{ success: boolean }>('/auth/logout', {
          refreshToken: refreshToken ?? undefined,
        });
      }
    } finally {
      await this.storage.clearTokens();
    }
  }

  async me(): Promise<AuthUser> {
    return this.client.get<AuthUser>('/auth/me');
  }

  async forgotPassword(input: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    return this.client.post<ForgotPasswordResponse>('/auth/forgot-password', input);
  }

  async resetPassword(input: ResetPasswordRequest): Promise<{ success: boolean; message: string }> {
    return this.client.post<{ success: boolean; message: string }>('/auth/reset-password', input);
  }

  async listUsers(page = 1, pageSize = 20): Promise<PaginatedResult<UserSummary>> {
    return this.client.get<PaginatedResult<UserSummary>>(
      `/auth/users?page=${page}&pageSize=${pageSize}`,
    );
  }

  async updateUser(id: string, data: { isActive?: boolean }): Promise<UserSummary> {
    return this.client.patch<UserSummary>(`/auth/users/${id}`, data);
  }

  async assignUserRole(id: string, input: AssignUserRoleRequest): Promise<AuthUser> {
    return this.client.post<AuthUser>(`/auth/users/${id}/roles`, input);
  }

  async removeUserRole(id: string, roleName: string): Promise<AuthUser> {
    return this.client.delete<AuthUser>(`/auth/users/${id}/roles/${roleName}`);
  }

  async listRoles(): Promise<RoleEntity[]> {
    return this.client.get<RoleEntity[]>('/auth/roles');
  }

  async listPermissions(): Promise<PermissionEntity[]> {
    return this.client.get<PermissionEntity[]>('/auth/roles/permissions/list');
  }

  async createRole(input: CreateRoleRequest): Promise<RoleEntity> {
    return this.client.post<RoleEntity>('/auth/roles', input);
  }

  async updateRole(roleId: string, input: UpdateRoleRequest): Promise<RoleEntity> {
    return this.client.patch<RoleEntity>(`/auth/roles/${roleId}`, input);
  }

  async setRolePermissions(roleId: string, input: AssignRolePermissionsRequest): Promise<RoleEntity> {
    return this.client.put<RoleEntity>(`/auth/roles/${roleId}/permissions`, input);
  }

  async deleteRole(roleId: string): Promise<{ success: boolean }> {
    return this.client.delete<{ success: boolean }>(`/auth/roles/${roleId}`);
  }

  // -- Dynamic database admin (schema-driven, admin:access only) -------------
  //
  // Every service exposes the same table editor under its own path segment, so
  // these take the segment (`auth`, `map`, `trips`, …) as their first argument.

  /** Every service with its tables, in one gateway round trip. */
  async listServices(): Promise<ServiceCatalogEntry[]> {
    return this.client.get<ServiceCatalogEntry[]>('/admin/services');
  }

  async listDbTables(segment: string): Promise<DbTableMeta[]> {
    return this.client.get<DbTableMeta[]>(`/${segment}/admin/db/tables`);
  }

  async getDbRows(
    segment: string,
    model: string,
    params: { page?: number; pageSize?: number; search?: string } = {},
  ): Promise<DbRowsResult> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.search?.trim()) query.set('search', params.search.trim());
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.client.get<DbRowsResult>(`/${segment}/admin/db/tables/${model}${suffix}`);
  }

  async createDbRow(
    segment: string,
    model: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.client.post<Record<string, unknown>>(`/${segment}/admin/db/tables/${model}`, {
      data,
    });
  }

  async updateDbRow(
    segment: string,
    model: string,
    where: Record<string, string>,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.client.patch<Record<string, unknown>>(`/${segment}/admin/db/tables/${model}`, {
      where,
      data,
    });
  }

  async deleteDbRow(
    segment: string,
    model: string,
    where: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.client.delete<{ success: boolean }>(`/${segment}/admin/db/tables/${model}`, {
      where,
    });
  }

  // -- Third-party integrations (admin:access only) ---------------------------

  async listIntegrations(): Promise<IntegrationsOverview> {
    return this.client.get<IntegrationsOverview>('/auth/admin/integrations');
  }

  /**
   * Omit a field to leave it unchanged — the form shows masked secrets, so only
   * what the admin actually retyped is sent. An empty string clears the stored
   * value and falls back to the environment variable.
   */
  async updateIntegration(
    provider: string,
    values: Record<string, string>,
  ): Promise<IntegrationStatus> {
    return this.client.put<IntegrationStatus>(`/auth/admin/integrations/${provider}`, { values });
  }

  async toggleIntegration(provider: string, enabled: boolean): Promise<IntegrationStatus> {
    return this.client.patch<IntegrationStatus>(`/auth/admin/integrations/${provider}`, {
      enabled,
    });
  }

  async clearIntegration(provider: string): Promise<IntegrationStatus> {
    return this.client.delete<IntegrationStatus>(`/auth/admin/integrations/${provider}`);
  }

  /** Makes a real call to the provider and reports what happened. */
  async testIntegration(provider: string): Promise<IntegrationTestResult> {
    return this.client.post<IntegrationTestResult>(
      `/auth/admin/integrations/${provider}/test`,
      {},
    );
  }

  async getAccessToken() {
    return this.storage.getAccessToken();
  }

  async isAuthenticated() {
    return Boolean(await this.storage.getAccessToken());
  }

  hasPermission(user: AuthUser | null, permission: string) {
    return Boolean(user?.permissions.includes(permission));
  }
}

export function createAuthApi(baseUrl: string, storage: TokenStorage) {
  return new AuthApi(baseUrl, storage);
}

export class ProfileApi {
  private readonly client: ApiClient;

  constructor(
    private readonly baseUrl: string,
    storage: TokenStorage,
  ) {
    this.client = createApiClient({
      baseUrl,
      getToken: () => storage.getAccessToken(),
    });
  }

  /** Stored media paths are relative to the API root, so they need the base URL to render. */
  resolveMediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return `${this.baseUrl}${path}`;
  }

  async getMyProfile(): Promise<UserProfile> {
    return this.client.get<UserProfile>('/users/profile');
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.client.get<UserProfile>(`/users/${userId}/profile`);
  }

  async updateProfile(input: UpdateProfileRequest): Promise<UserProfile> {
    return this.client.patch<UserProfile>('/users/profile', input);
  }

  async uploadAvatar(file: File | Blob): Promise<UserProfile> {
    const form = new FormData();
    form.append('file', file);
    return this.client.postForm<UserProfile>('/users/profile/avatar', form);
  }

  async removeAvatar(): Promise<UserProfile> {
    return this.client.delete<UserProfile>('/users/profile/avatar');
  }

  async addPhoto(file: File | Blob, caption?: string): Promise<UserProfile> {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return this.client.postForm<UserProfile>('/users/profile/photos', form);
  }

  async updatePhoto(photoId: string, caption: string): Promise<UserProfile> {
    return this.client.patch<UserProfile>(`/users/profile/photos/${photoId}`, { caption });
  }

  async removePhoto(photoId: string): Promise<UserProfile> {
    return this.client.delete<UserProfile>(`/users/profile/photos/${photoId}`);
  }

  async setSocialLink(input: UpsertSocialLinkRequest): Promise<UserProfile> {
    return this.client.put<UserProfile>('/users/profile/social-links', input);
  }

  async removeSocialLink(platform: string): Promise<UserProfile> {
    return this.client.delete<UserProfile>(`/users/profile/social-links/${platform}`);
  }
}

export function createProfileApi(baseUrl: string, storage: TokenStorage) {
  return new ProfileApi(baseUrl, storage);
}

export function createMemoryTokenStorage(): TokenStorage {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  return {
    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,
    setTokens: (tokens) => {
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    },
    clearTokens: () => {
      accessToken = null;
      refreshToken = null;
    },
  };
}

export function createLocalStorageTokenStorage(key = 'tg_auth'): TokenStorage {
  const read = () => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  };

  return {
    getAccessToken: () => read()?.accessToken ?? null,
    getRefreshToken: () => read()?.refreshToken ?? null,
    setTokens: (tokens) => {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(tokens));
    },
    clearTokens: () => {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
    },
  };
}
