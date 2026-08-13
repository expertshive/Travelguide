import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { CalculateRouteDto, EstimateStopImpactDto, RerouteDto } from './dto/routes.dto';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@ApiBearerAuth()
@Controller('map/routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate a route between two points' })
  calculate(@CurrentUser() user: AuthUser, @Body() dto: CalculateRouteDto) {
    return this.routes.calculate(user.userId, dto);
  }

  @Post('alternatives')
  @ApiOperation({ summary: 'Calculate a route plus alternative options' })
  alternatives(@CurrentUser() user: AuthUser, @Body() dto: CalculateRouteDto) {
    return this.routes.alternatives(user.userId, dto);
  }

  @Post('reroute')
  @ApiOperation({ summary: 'Recalculate after the traveller leaves the route' })
  reroute(@CurrentUser() user: AuthUser, @Body() dto: RerouteDto) {
    return this.routes.reroute(user.userId, dto);
  }

  @Post('estimate-stop-impact')
  @ApiOperation({ summary: 'Added time and distance from inserting a stop' })
  estimateStopImpact(@CurrentUser() user: AuthUser, @Body() dto: EstimateStopImpactDto) {
    return this.routes.estimateStopImpact(user.userId, dto);
  }
}
