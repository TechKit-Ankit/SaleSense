import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { StoreUserRole } from '@salesense/db';
import { ChatDto } from './dto/chat.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly aiService: AiService,
  ) {}

  @Get('summary')
  async getSummary(
    @StoreId() storeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getSummary(storeId, startDate, endDate);
  }

  @Get('revenue')
  async getRevenueChart(
    @StoreId() storeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('productId') productId?: string,
  ) {
    return this.analyticsService.getRevenueChart(storeId, startDate, endDate, productId);
  }

  @Get('top-products')
  async getTopProducts(
    @StoreId() storeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTopProducts(storeId, startDate, endDate);
  }

  @Get('dead-stock')
  async getDeadStock(
    @StoreId() storeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getDeadStock(storeId, startDate, endDate);
  }

  @Get('inventory-health')
  async getInventoryHealth(
    @StoreId() storeId: string,
  ) {
    return this.analyticsService.getInventoryHealth(storeId);
  }

  @Get('ai-status')
  getAiStatus() {
    return { isConfigured: this.aiService.isAiConfigured() };
  }

  @Post('chat')
  async chatWithAi(
    @StoreId() storeId: string,
    @Body() dto: ChatDto,
  ) {
    const aiResponse = await this.aiService.generateChatResponse(storeId, dto.message);
    return { response: aiResponse };
  }
}
