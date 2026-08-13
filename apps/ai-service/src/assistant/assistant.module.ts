import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

@Module({
  controllers: [AssistantController, TtsController],
  providers: [AssistantService, TtsService],
})
export class AssistantModule {}
