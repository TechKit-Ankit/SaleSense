import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreUserRole } from '@salesense/db';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post()
  create(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Body() createPurchaseDto: CreatePurchaseDto,
  ) {
    return this.purchasesService.create(storeId, userId, createPurchaseDto);
  }

  @Get()
  findAll(@StoreId() storeId: string) {
    return this.purchasesService.findAll(storeId);
  }

  @Get(':id')
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.purchasesService.findOne(storeId, id);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Patch(':id/receive')
  receive(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.purchasesService.receive(storeId, userId, id);
  }
}
