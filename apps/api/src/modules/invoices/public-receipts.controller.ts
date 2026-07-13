import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { InvoicesService } from './invoices.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Customer-facing receipt access (design 0009, Gate 2 upgrade): the share
 * token IS the authorization — it can only be minted through the
 * authenticated invoice endpoint. No login, strict throttle, invalid or
 * expired tokens get a generic 404 (no validity oracle).
 */
@Controller('public/receipts')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PublicReceiptsController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Public()
  @Get(':token')
  getReceipt(@Param('token') token: string) {
    return this.invoicesService.getPublicReceipt(token);
  }

  @Public()
  @Get(':token/pdf')
  async getReceiptPdf(@Param('token') token: string, @Res() res: Response) {
    const receipt = await this.invoicesService.getPublicReceipt(token);
    const pdf = await this.invoicesService.buildPdf(receipt);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${receipt.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
