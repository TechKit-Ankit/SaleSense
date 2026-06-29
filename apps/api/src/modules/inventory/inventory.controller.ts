import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreUserRole } from '@salesense/db';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getOverview(@StoreId() storeId: string) {
    return this.inventoryService.getOverview(storeId);
  }

  @Get('movements')
  getMovements(
    @StoreId() storeId: string,
    @Query('productId') productId?: string,
  ) {
    return this.inventoryService.getMovements(storeId, productId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post('adjustments')
  createAdjustment(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStockAdjustmentDto,
  ) {
    return this.inventoryService.createAdjustment(storeId, userId, dto);
  }
}
