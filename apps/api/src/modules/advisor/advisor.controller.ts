import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { RecommendationsDto } from './dto/recommendations.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { StoreUserRole } from '@salesense/db';

@Controller('advisor')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Post('recommendations')
  getRecommendations(@StoreId() storeId: string, @Body() dto: RecommendationsDto) {
    return this.advisorService.getRecommendations(storeId, dto.periodDays);
  }
}
