import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@ApiBearerAuth()
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Save a completed navigation trip' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTripDto) {
    return this.trips.create(user.userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List the traveler’s past trips' })
  list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 20;
    return this.trips.list(user.userId, Number.isFinite(n) ? n : 20);
  }
}
