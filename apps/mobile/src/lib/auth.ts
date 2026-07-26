import { Platform } from 'react-native';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from './storage';
import type { ApiResponse, AuthTokens, AuthUser } from './types';

const API_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000/v1' : 'http://localhost:4000/v1';

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  // FormData must set its own Content-Type so the multipart boundary is included.
  const isFormData = init.body instanceof FormData;
  if (!headers.has('Content-Type') && init.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? response.statusText);
  }

  return payload.data as T;
}

export function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const tokens = await request<AuthTokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveTokens(tokens);
  return tokens;
}

export type SendRegisterOtpInput = {
  email: string;
  name: string;
  mobile: string;
  password: string;
  confirmPassword: string;
};

export async function sendRegisterOtp(input: SendRegisterOtpInput) {
  return request<{ message: string; otpHint?: string }>('/auth/register/send-otp', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifyRegisterOtp(email: string, otp: string): Promise<AuthTokens> {
  const tokens = await request<AuthTokens>('/auth/register/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
  await saveTokens(tokens);
  return tokens;
}

export async function register(
  input: SendRegisterOtpInput & { otp: string },
): Promise<AuthTokens> {
  await sendRegisterOtp(input);
  return verifyRegisterOtp(input.email, input.otp);
}

export async function refreshTokens(): Promise<AuthTokens> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const tokens = await request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  await saveTokens(tokens);
  return tokens;
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
      }, true);
    }
  } finally {
    await clearTokens();
  }
}

export async function me(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me', {}, true);
}

export async function forgotPassword(email: string) {
  return request<{ message: string; resetToken?: string; resetUrl?: string }>(
    '/auth/forgot-password',
    { method: 'POST', body: JSON.stringify({ email }) },
  );
}

export async function resetPassword(token: string, password: string) {
  return request<{ success: boolean; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getAccessToken());
}

export { API_BASE };
