import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to revoke. Omit to logout current session only.' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
