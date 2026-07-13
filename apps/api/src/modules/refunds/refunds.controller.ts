import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestId } from '../../common/decorators/request-id.decorator';
import { StoreUserRole } from '@salesense/db';

@Controller()
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  // Cashiers may REQUEST a refund (api/0001); approval stays with Owner/Manager.
  @Post('sales/:saleId/refunds')
  requestRefund(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Param('saleId') saleId: string,
    @Body() dto: CreateRefundDto,
    @RequestId() requestId: string,
  ) {
    return this.refundsService.requestRefund(storeId, userId, saleId, dto, requestId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Get('refunds')
  listRefunds(@StoreId() storeId: string) {
    return this.refundsService.listRefunds(storeId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Get('refunds/:refundId')
  getRefund(@StoreId() storeId: string, @Param('refundId') refundId: string) {
    return this.refundsService.getRefund(storeId, refundId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post('refunds/:refundId/approve')
  approve(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Param('refundId') refundId: string,
    @RequestId() requestId: string,
  ) {
    return this.refundsService.approve(storeId, userId, refundId, requestId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post('refunds/:refundId/reject')
  reject(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Param('refundId') refundId: string,
    @RequestId() requestId: string,
  ) {
    return this.refundsService.reject(storeId, userId, refundId, requestId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post('refunds/:refundId/complete')
  complete(
    @StoreId() storeId: string,
    @CurrentUser('id') userId: string,
    @Param('refundId') refundId: string,
    @RequestId() requestId: string,
  ) {
    return this.refundsService.complete(storeId, userId, refundId, requestId);
  }
}
