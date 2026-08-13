import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import type { LatLng } from './map';

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
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

/** Continuously watch position; returns a watch id to clear later. */
export function watchPosition(onChange: (p: LatLng) => void): number {
  return Geolocation.watchPosition(
    (pos) => onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => {},
    { enableHighAccuracy: true, distanceFilter: 8, interval: 3000, fastestInterval: 1500 },
  );
}

export function clearWatch(id: number): void {
  Geolocation.clearWatch(id);
}
