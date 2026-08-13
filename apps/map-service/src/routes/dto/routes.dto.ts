import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ROUTE_PREFERENCES, TRAVEL_MODES } from '../../providers/types';

export class PointDto {
  @ApiProperty({ example: 24.7136 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 46.6753 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class AvoidDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() tolls?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() highways?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() unpaved?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ferries?: boolean;
}

export class CalculateRouteDto {
  @ApiProperty({ type: PointDto })
  @ValidateNested()
  @Type(() => PointDto)
  origin!: PointDto;

  @ApiProperty({ type: PointDto })
  @ValidateNested()
  @Type(() => PointDto)
  destination!: PointDto;

  @ApiPropertyOptional({ type: [PointDto], description: 'Ordered intermediate stops' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  waypoints?: PointDto[];

  @ApiPropertyOptional({ enum: TRAVEL_MODES, default: 'driving' })
  @IsOptional()
  @IsIn(TRAVEL_MODES)
  mode?: (typeof TRAVEL_MODES)[number];

  @ApiPropertyOptional({ enum: ROUTE_PREFERENCES, default: 'fastest' })
  @IsOptional()
  @IsIn(ROUTE_PREFERENCES)
  preference?: (typeof ROUTE_PREFERENCES)[number];

  @ApiPropertyOptional({ type: AvoidDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AvoidDto)
  avoid?: AvoidDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  alternatives?: boolean;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class RerouteDto extends CalculateRouteDto {
  @ApiProperty({ type: PointDto, description: 'Where the traveller actually is' })
  @ValidateNested()
  @Type(() => PointDto)
  currentPosition!: PointDto;
}

export class EstimateStopImpactDto extends CalculateRouteDto {
  @ApiProperty({ type: PointDto, description: 'Candidate stop to insert' })
  @ValidateNested()
  @Type(() => PointDto)
  candidateStop!: PointDto;
}
