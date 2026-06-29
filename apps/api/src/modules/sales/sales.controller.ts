import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, SyncSalesDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Body() createSaleDto: CreateSaleDto,
  ) {
    // Generate a quick request ID if we don't have trace IDs configured yet
    const requestId = `req_${Date.now()}`;
    return this.salesService.createSale(storeId, userId, createSaleDto, requestId);
  }

  @Post('sync')
  syncSales(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Body() syncSalesDto: SyncSalesDto,
  ) {
    const requestId = `sync_${Date.now()}`;
    return this.salesService.syncSales(storeId, userId, syncSalesDto.sales, requestId);
  }
}
