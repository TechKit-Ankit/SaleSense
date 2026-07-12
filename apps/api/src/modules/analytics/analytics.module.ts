import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AiService } from './ai.service';
import { AdvisorModule } from '../advisor/advisor.module';

@Module({
  // AdvisorModule exports AdvisorService so the AI chat receives the same
  // deterministic findings the dashboard shows (design doc 0008).
  imports: [AdvisorModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AiService]
})
export class AnalyticsModule {}
