import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AssistantRequestDto {
  @ApiProperty({ example: 'What is the weather like at my destination?' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Current trip context: destination, origin, route style, stops, etc.',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, description: 'Recent turns for continuity.' })
  @IsOptional()
  @IsObject()
  history?: Record<string, unknown>;
}
