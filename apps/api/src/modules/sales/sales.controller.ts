import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, SyncSalesDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestId } from '../../common/decorators/request-id.decorator';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Body() createSaleDto: CreateSaleDto,
    @RequestId() requestId: string,
  ) {
    return this.salesService.createSale(storeId, userId, createSaleDto, requestId);
  }

  @Post('sync')
  syncSales(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Body() syncSalesDto: SyncSalesDto,
    @RequestId() requestId: string,
  ) {
    return this.salesService.syncSales(storeId, userId, syncSalesDto.sales, requestId);
  }
}
