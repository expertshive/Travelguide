import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { AssistantRequestDto } from './dto/assistant.dto';

@ApiTags('assistant')
@Controller('ai/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post()
  @ApiOperation({ summary: 'Conversational travel voice assistant (reply + one action)' })
  ask(@Body() dto: AssistantRequestDto) {
    return this.assistant.ask(dto.message, (dto.context ?? {}) as never);
  }
}
