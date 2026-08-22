import { Module } from '@nestjs/common';
import { HeritageController } from './heritage.controller';
import { HeritageService } from './heritage.service';

@Module({
  controllers: [HeritageController],
  providers: [HeritageService],
})
export class HeritageModule {}
