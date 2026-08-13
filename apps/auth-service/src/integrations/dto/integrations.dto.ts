import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject } from 'class-validator';

export class UpdateIntegrationDto {
  @ApiProperty({
    type: Object,
    description:
      'Field values keyed by name, e.g. { "GEMINI_API_KEY": "…" }. Omit a field to leave it unchanged; send an empty string to clear it and fall back to the environment variable.',
  })
  @IsObject()
  values!: Record<string, string>;
}

export class ToggleIntegrationDto {
  @ApiProperty({ description: 'Whether the integration may be used.' })
  @IsBoolean()
  enabled!: boolean;
}
