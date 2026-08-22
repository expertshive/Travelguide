import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsLatitude,
  IsNumber,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TripStopDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  address!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class CreateTripDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  originName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  originAddress!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  originLatitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  originLongitude!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  destinationName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  destinationAddress!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  destinationLatitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  destinationLongitude!: number;

  @ApiPropertyOptional({ type: [TripStopDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripStopDto)
  stops?: TripStopDto[];

  @ApiPropertyOptional({ example: 'driving' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mode?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceMeters!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationSeconds!: number;

  @ApiProperty()
  @IsDateString()
  startedAt!: string;

  @ApiProperty()
  @IsDateString()
  endedAt!: string;

  @ApiPropertyOptional({ description: 'True when the traveler reached the destination' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
