import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class PointDto {
  @ApiProperty({ example: 31.52 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 74.35 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class HeritageAlongRouteDto {
  @ApiProperty({ type: [PointDto], description: 'Decoded route polyline (origin → destination).' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(800)
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  geometry!: PointDto[];

  @ApiProperty({ example: 2000, description: 'Max metres off the route to consider.' })
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(20_000)
  radiusMeters!: number;

  @ApiPropertyOptional({ type: PointDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PointDto)
  origin?: PointDto;
}
