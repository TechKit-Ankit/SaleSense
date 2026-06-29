import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AiService } from './ai.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AiService]
})
export class AnalyticsModule {}
