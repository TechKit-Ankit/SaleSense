import { Injectable } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { BusinessException } from '../../common/errors/business-exception.js';
import { RESOURCE_NOT_FOUND, ERROR_CODE_HTTP_STATUS } from '../../common/errors/error-codes.js';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full receipt payload for one invoice (design doc 0009).
   * Snapshots only — never live product/store data — and cost/profit fields
   * are deliberately never mapped: a customer-facing document must not leak
   * margins.
   */
  async getInvoice(storeId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        sale: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
    });

    if (!invoice || invoice.storeId !== storeId) {
      throw new BusinessException(
        RESOURCE_NOT_FOUND,
        'Invoice was not found.',
        ERROR_CODE_HTTP_STATUS[RESOURCE_NOT_FOUND] ?? 404,
      );
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      financialYear: invoice.financialYear,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      store: {
        nameSnapshot: invoice.storeNameSnapshot,
        addressSnapshot: invoice.storeAddressSnapshot,
        gstNumberSnapshot: invoice.gstNumberSnapshot,
      },
      sale: {
        id: invoice.sale.id,
        createdAt: invoice.sale.createdAt,
        paymentStatus: invoice.sale.paymentStatus,
        subtotalPaise: Number(invoice.sale.subtotalPaise),
        discountPaise: Number(invoice.sale.discountPaise),
        taxPaise: Number(invoice.sale.taxPaise),
        totalPaise: Number(invoice.sale.totalPaise),
        items: invoice.sale.items.map((item) => ({
          productNameSnapshot: item.productNameSnapshot,
          hsnCodeSnapshot: item.hsnCodeSnapshot,
          quantity: item.quantity,
          unitSellingPricePaise: Number(item.unitSellingPricePaise),
          discountPaise: Number(item.discountPaise),
          taxRateBps: item.taxRateBps,
          taxPaise: Number(item.taxPaise),
          lineTotalPaise: Number(item.lineTotalPaise),
        })),
        payments: invoice.sale.payments.map((p) => ({
          method: p.method,
          amountPaise: Number(p.amountPaise),
        })),
      },
    };
  }
}
