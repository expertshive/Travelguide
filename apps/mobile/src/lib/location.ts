import Geolocation from '@react-native-community/geolocation';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import type { LatLng } from './map';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto',
});

export type LocationIssue = 'denied' | 'disabled' | 'timeout' | 'error';

export type LocateResult =
  | { ok: true; position: LatLng }
  | { ok: false; reason: LocationIssue; message: string };

let lastKnown: LatLng | null = null;

/** Last successful GPS/network fix — used to open the map instantly. */
export function peekLastLocation(): LatLng | null {
  return lastKnown;
}

function remember(position: LatLng): LatLng {
  lastKnown = position;
  return position;
}

async function requestAndroidPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  try {
    const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (already) return 'granted';
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Use your location',
        message: 'Traveler Guide needs your location to show you on the map and guide your trip.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    if (status === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch {
    return 'denied';
  }
}

export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    } catch {
      return false;
    }
  }
  return true;
}

/** Ask for foreground location permission on both platforms. */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      );
    });
  }
  return (await requestAndroidPermission()) === 'granted';
}

export function openLocationSettings(): void {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
      void Linking.openSettings();
    });
    return;
  }
  void Linking.openSettings();
}

export function openAppSettings(): void {
  void Linking.openSettings();
}

export function promptEnableGps(): void {
  Alert.alert(
    'Turn on location',
    'Location is off. Enable GPS so the map can show where you are.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: openLocationSettings },
    ],
  );
}

export function promptAllowLocation(): void {
  Alert.alert(
    'Allow location',
    'Allow location so the map can open at where you are.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: openAppSettings },
    ],
  );
}

function readPosition(highAccuracy: boolean, timeout: number, maximumAge: number): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge },
    );
  });
}

function classifyError(error: unknown): { reason: LocationIssue; message: string } {
  const code = typeof error === 'object' && error && 'code' in error ? Number(error.code) : 0;
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: string }).message)
      : error instanceof Error
        ? error.message
        : 'Could not read your location';
  const text = message.toLowerCase();
  if (code === 1 || text.includes('permission')) {
    return { reason: 'denied', message };
  }
  if (
    code === 2 ||
    text.includes('disabled') ||
    text.includes('no location provider') ||
    text.includes('unavailable')
  ) {
    return { reason: 'disabled', message };
  }
  if (code === 3 || text.includes('timeout')) {
    return { reason: 'timeout', message };
  }
  return { reason: 'error', message };
}

/**
 * Permission first. Then a cached/network fix (fast), GPS only if needed.
 * Never waits more than a few seconds before returning a last-known point.
 */
export async function locateUser(): Promise<LocateResult> {
  if (Platform.OS === 'android') {
    const android = await requestAndroidPermission();
    if (android !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Location permission was not granted.',
      };
    }
  } else {
    const ok = await requestLocationPermission();
    if (!ok) {
      return { ok: false, reason: 'denied', message: 'Location permission was not granted.' };
    }
  }

  try {
    return { ok: true, position: remember(await readPosition(false, 3500, 180_000)) };
  } catch {
    /* try GPS */
  }

  try {
    return { ok: true, position: remember(await readPosition(true, 5000, 15_000)) };
  } catch (error) {
    if (lastKnown) return { ok: true, position: lastKnown };
    return { ok: false, ...classifyError(error) };
  }
}

export function getCurrentPosition(): Promise<LatLng> {
  return readPosition(true, 8000, 10_000).then(remember);
}

export function watchPosition(onChange: (p: LatLng) => void): number {
  return Geolocation.watchPosition(
    (pos) => {
      const next = remember({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      onChange(next);
    },
    () => {},
    { enableHighAccuracy: true, distanceFilter: 8, interval: 3000, fastestInterval: 1500 },
  );
}

export function clearWatch(id: number): void {
  Geolocation.clearWatch(id);
}
