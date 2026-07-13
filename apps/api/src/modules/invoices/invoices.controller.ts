import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';

// No @Roles: any ACTIVE store member (Owner/Manager/Cashier) may read/reprint
// a receipt — StoreAccessGuard still enforces membership (design doc 0009).
@Controller('invoices')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':invoiceId')
  getInvoice(@StoreId() storeId: string, @Param('invoiceId') invoiceId: string) {
    return this.invoicesService.getInvoice(storeId, invoiceId);
  }
}
