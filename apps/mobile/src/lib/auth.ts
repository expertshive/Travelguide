import { NativeModules, Platform } from 'react-native';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from './storage';
import type { ApiResponse, AuthTokens, AuthUser } from './types';

const API_PORT = 4000;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Used only when the bundle host cannot be read, which in practice means a
 * release build. Find the current value with `ipconfig getifaddr en0`.
 */
const FALLBACK_DEV_HOST = '172.20.10.2';

/**
 * Host serving the JS bundle, which is by definition the development machine —
 * the same one running the API.
 *
 * A physical iPhone cannot reach the Mac as `localhost`, so it needs the Mac's
 * LAN address, and hard-coding that address means the app silently stops working
 * every time the Mac changes network. Metro already had to tell the device where
 * to fetch the bundle from, so that address is reused instead of being maintained
 * by hand.
 */
function bundleHost(): string | null {
  const scriptUrl = (NativeModules.SourceCode?.scriptURL ?? '') as string;
  // e.g. http://192.168.1.20:8081/index.bundle?platform=ios — take the hostname.
  // A bundle read from disk reports a file:// URL, which names no host — the
  // pattern only matches http(s), so that case falls through to null.
  const match = /^https?:\/\/([^/:]+)/.exec(scriptUrl);
  return match?.[1] ?? null;
}

function resolveApiBase(): string {
  // The Android emulator reaches its host only through this alias.
  if (Platform.OS === 'android') {
    const host = bundleHost();
    const usable = host && host !== 'localhost' && host !== '127.0.0.1' ? host : '10.0.2.2';
    return `http://${usable}:${API_PORT}/v1`;
  }
  return `http://${bundleHost() ?? FALLBACK_DEV_HOST}:${API_PORT}/v1`;
}

const API_BASE = resolveApiBase();

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

  // Without a deadline an unreachable host leaves the promise pending forever:
  // a TCP connect to a dead address on the local subnet is dropped rather than
  // refused, so the app would sit on its loading screen indefinitely instead of
  // reporting that the backend is down.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Could not reach the server at ${API_BASE}. Is it running?`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

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
