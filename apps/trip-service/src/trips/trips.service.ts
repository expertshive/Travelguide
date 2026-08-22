import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTripDto, TripStopDto } from './dto/create-trip.dto';

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
  stops: TripStopDto[];
  mode: string;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  completed: boolean;
  createdAt: Date;
};

function parseStops(raw: string | null): TripStopDto[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TripStopDto[]) : [];
  } catch {
    return [];
  }
}

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateTripDto): Promise<SavedTrip> {
    const row = await this.prisma.trip.create({
      data: {
        userId,
        originName: input.originName.trim(),
        originAddress: input.originAddress,
        originLatitude: input.originLatitude,
        originLongitude: input.originLongitude,
        destinationName: input.destinationName.trim(),
        destinationAddress: input.destinationAddress,
        destinationLatitude: input.destinationLatitude,
        destinationLongitude: input.destinationLongitude,
        stopsJson: input.stops?.length ? JSON.stringify(input.stops) : null,
        mode: input.mode?.trim() || 'driving',
        distanceMeters: Math.round(input.distanceMeters),
        durationSeconds: Math.round(input.durationSeconds),
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        completed: input.completed ?? true,
      },
    });
    return this.toSaved(row);
  }

  async list(userId: string, limit = 20): Promise<SavedTrip[]> {
    const rows = await this.prisma.trip.findMany({
      where: { userId },
      orderBy: { endedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return rows.map((row) => this.toSaved(row));
  }

  private toSaved(row: {
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
    stopsJson: string | null;
    mode: string;
    distanceMeters: number;
    durationSeconds: number;
    startedAt: Date;
    endedAt: Date;
    completed: boolean;
    createdAt: Date;
  }): SavedTrip {
    return {
      id: row.id,
      userId: row.userId,
      originName: row.originName,
      originAddress: row.originAddress,
      originLatitude: row.originLatitude,
      originLongitude: row.originLongitude,
      destinationName: row.destinationName,
      destinationAddress: row.destinationAddress,
      destinationLatitude: row.destinationLatitude,
      destinationLongitude: row.destinationLongitude,
      stops: parseStops(row.stopsJson),
      mode: row.mode,
      distanceMeters: row.distanceMeters,
      durationSeconds: row.durationSeconds,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      completed: row.completed,
      createdAt: row.createdAt,
    };
  }
}
