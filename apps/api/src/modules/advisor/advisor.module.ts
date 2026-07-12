import { Module } from '@nestjs/common';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  controllers: [AdvisorController],
  providers: [AdvisorService],
  // Exported deliberately: P4.4 injects AdvisorService into AiService so the
  // LLM chat receives the same deterministic recommendations as context.
  exports: [AdvisorService],
})
export class AdvisorModule {}
