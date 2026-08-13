import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TtsService, type Gender } from './tts.service';

class TtsRequestDto {
  @ApiProperty({ example: 'Turn right in 300 meters.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1200)
  text!: string;

  @ApiPropertyOptional({ enum: ['male', 'female'], default: 'female' })
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Override the ElevenLabs voice id.' })
  @IsOptional()
  @IsString()
  voiceId?: string;
}

@ApiTags('assistant')
@Controller('ai/tts')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Post()
  @ApiOperation({ summary: 'Synthesize speech (ElevenLabs). Returns base64 audio or null.' })
  speak(@Body() dto: TtsRequestDto) {
    return this.tts.synthesize(dto.text, dto.gender ?? 'female', dto.voiceId);
  }
}
