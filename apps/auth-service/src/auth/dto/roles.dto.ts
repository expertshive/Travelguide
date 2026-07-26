import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'guide' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignRolePermissionsDto {
  @ApiProperty({ example: ['user:read', 'trip:read'] })
  @IsString({ each: true })
  permissions!: string[];
}
