import AsyncStorage from '@react-native-async-storage/async-storage';
import { authorizedRequest } from './auth';

const LOCAL_KEY = 'tg_completed_trips';
const MAX_LOCAL = 40;

export type TripStop = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type SavedTrip = {
  id: string;
  userId: string;
  originName: string;
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationName: string;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  stops: TripStop[];
  mode: string;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  createdAt: string;
};

export type SaveTripInput = {
  originName: string;
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationName: string;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  stops?: TripStop[];
  mode?: string;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
  completed?: boolean;
};

function asIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function normalize(trip: SavedTrip): SavedTrip {
  return {
    ...trip,
    stops: trip.stops ?? [],
    startedAt: asIso(trip.startedAt),
    endedAt: asIso(trip.endedAt),
    createdAt: asIso(trip.createdAt),
  };
}

async function readLocal(): Promise<SavedTrip[]> {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedTrip[];
    return Array.isArray(parsed) ? parsed.map(normalize) : [];
  } catch {
    return [];
  }
}

async function writeLocal(trips: SavedTrip[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(trips.slice(0, MAX_LOCAL)));
}

async function rememberLocal(trip: SavedTrip): Promise<void> {
  const existing = await readLocal();
  await writeLocal([trip, ...existing.filter((t) => t.id !== trip.id)]);
}

export async function saveCompletedTrip(input: SaveTripInput): Promise<SavedTrip> {
  try {
    const saved = normalize(
      await authorizedRequest<SavedTrip>('/trips', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
    await rememberLocal(saved);
    return saved;
  } catch {
    const now = new Date().toISOString();
    const local: SavedTrip = {
      id: `local-${Date.now()}`,
      userId: 'me',
      originName: input.originName,
      originAddress: input.originAddress,
      originLatitude: input.originLatitude,
      originLongitude: input.originLongitude,
      destinationName: input.destinationName,
      destinationAddress: input.destinationAddress,
      destinationLatitude: input.destinationLatitude,
      destinationLongitude: input.destinationLongitude,
      stops: input.stops ?? [],
      mode: input.mode ?? 'driving',
      distanceMeters: Math.round(input.distanceMeters),
      durationSeconds: Math.round(input.durationSeconds),
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      completed: input.completed ?? true,
      createdAt: now,
    };
    await rememberLocal(local);
    return local;
  }
}

export async function listPastTrips(): Promise<SavedTrip[]> {
  try {
    const remote = await authorizedRequest<SavedTrip[]>('/trips');
    const trips = (remote ?? []).map(normalize);
    if (trips.length) return trips;
  } catch {
    // Trip-service may not be deployed yet — Home still shows on-device history.
  }
  return readLocal();
}
