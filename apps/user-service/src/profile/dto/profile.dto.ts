import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { SOCIAL_PLATFORMS } from '../social-platforms';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Huzaifa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Traveler and photographer based in Riyadh.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'Riyadh, Saudi Arabia' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class UpsertSocialLinkDto {
  @ApiProperty({ enum: SOCIAL_PLATFORMS, example: 'instagram' })
  @IsIn(SOCIAL_PLATFORMS as unknown as string[])
  platform!: string;

  @ApiProperty({ example: 'https://instagram.com/username' })
  @IsUrl({ require_protocol: true }, { message: 'Enter a full URL including https://' })
  @MaxLength(300)
  url!: string;
}

export class UpdatePhotoDto {
  @ApiPropertyOptional({ example: 'Sunset in AlUla' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  caption?: string;
}
