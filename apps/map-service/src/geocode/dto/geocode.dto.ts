import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: 'King Fahd Road' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional({ description: 'Bias results near this latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Bias results near this longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ReverseQueryDto {
  @ApiProperty({ example: 24.7136 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 46.6753 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class SavePlaceDto {
  @ApiProperty({ enum: ['HOME', 'WORK', 'CUSTOM'] })
  @IsString()
  label!: 'HOME' | 'WORK' | 'CUSTOM';

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
