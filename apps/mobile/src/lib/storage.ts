import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from './types';

const STORAGE_KEY = 'tg_mobile_auth';

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  return tokens?.accessToken ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  return tokens?.refreshToken ?? null;
}
