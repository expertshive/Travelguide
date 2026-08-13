import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { ProviderRegistry } from '../providers/provider.registry';
import { ReverseQueryDto, SavePlaceDto, SearchQueryDto } from './dto/geocode.dto';
import { GeocodeService } from './geocode.service';

@ApiTags('geocode')
@ApiBearerAuth()
@Controller('map/geocode')
export class GeocodeController {
  constructor(
    private readonly geocode: GeocodeService,
    private readonly registry: ProviderRegistry,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Map style and public token for the client renderer' })
  config() {
    return this.registry.getStyleConfig();
  }

  @Get('search')
  @ApiOperation({ summary: 'Address autocomplete and place search' })
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    const near =
      query.latitude !== undefined && query.longitude !== undefined
        ? { latitude: query.latitude, longitude: query.longitude }
        : undefined;

    return this.geocode.search(user.userId, query.q, near, query.limit ?? 8);
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Resolve coordinates to an address (drop a pin)' })
  reverse(@CurrentUser() user: AuthUser, @Query() query: ReverseQueryDto) {
    return this.geocode.reverse(user.userId, {
      latitude: query.latitude,
      longitude: query.longitude,
    });
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthUser) {
    return this.geocode.listRecentSearches(user.userId);
  }

  @Delete('recent')
  clearRecent(@CurrentUser() user: AuthUser) {
    return this.geocode.clearRecentSearches(user.userId);
  }

  @Get('places')
  savedPlaces(@CurrentUser() user: AuthUser) {
    return this.geocode.listSavedPlaces(user.userId);
  }

  @Post('places')
  @ApiOperation({ summary: 'Save Home, Work, or a custom place' })
  savePlace(@CurrentUser() user: AuthUser, @Body() dto: SavePlaceDto) {
    return this.geocode.savePlace(user.userId, dto);
  }

  @Delete('places/:id')
  deletePlace(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.geocode.deleteSavedPlace(user.userId, id);
  }
}
