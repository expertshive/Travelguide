import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { HeritageAlongRouteDto } from './dto';
import { HeritageService } from './heritage.service';

@ApiTags('heritage')
@ApiBearerAuth()
@Controller('map/heritage')
export class HeritageController {
  constructor(private readonly heritage: HeritageService) {}

  @Post('along-route')
  @ApiOperation({
    summary: 'Historical / cultural places within radius of the driving polyline (cached).',
  })
  alongRoute(@CurrentUser() user: AuthUser, @Body() dto: HeritageAlongRouteDto) {
    return this.heritage.alongRoute(user.userId, dto.geometry, dto.radiusMeters, dto.origin);
  }
}
