import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@salesense/db';
import PDFDocument from 'pdfkit';
import { BusinessException } from '../../common/errors/business-exception.js';
import { RESOURCE_NOT_FOUND, ERROR_CODE_HTTP_STATUS } from '../../common/errors/error-codes.js';

/** Public share tokens live this long (design 0009, Gate 2 upgrade). */
const SHARE_TOKEN_TTL = '30d';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private notFound(): never {
    throw new BusinessException(
      RESOURCE_NOT_FOUND,
      'Invoice was not found.',
      ERROR_CODE_HTTP_STATUS[RESOURCE_NOT_FOUND] ?? 404,
    );
  }

  async getInvoice(storeId: string, invoiceId: string) {
    const receipt = await this.loadReceipt(invoiceId);
    if (!receipt || receipt._storeId !== storeId) this.notFound();
    const { _storeId, ...payload } = receipt;
    return {
      ...payload,
      // Stateless public-share authorization: can only be minted through
      // this authenticated call (design 0009, Gate 2 upgrade).
      shareToken: this.jwtService.sign(
        { inv: invoiceId, typ: 'receipt' },
        { secret: process.env.JWT_SECRET || 'secret', expiresIn: SHARE_TOKEN_TTL },
      ),
    };
  }

  /** Resolves a public share token. Invalid/expired → generic 404 (no oracle). */
  async getPublicReceipt(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'secret' });
      if (payload.typ !== 'receipt' || !payload.inv) throw new Error('wrong type');
    } catch {
      this.notFound();
    }
    const receipt = await this.loadReceipt(payload.inv);
    if (!receipt) this.notFound();
    const { _storeId, customer, ...publicPayload } = receipt;
    return publicPayload;
  }

  /** Renders the receipt as a PDF (pdfkit — design 0009, Gate 2 upgrade). */
  async buildPdf(receipt: Awaited<ReturnType<InvoicesService['getPublicReceipt']>>): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A6', margin: 18 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const rupees = (paise: number) => `Rs ${(paise / 100).toFixed(2)}`;

    doc.font('Helvetica-Bold').fontSize(12).text(receipt.store.nameSnapshot, { align: 'center' });
    doc.font('Helvetica').fontSize(7);
    if (receipt.store.addressSnapshot) doc.text(receipt.store.addressSnapshot, { align: 'center' });
    if (receipt.store.gstNumberSnapshot) doc.text(`GSTIN: ${receipt.store.gstNumberSnapshot}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).text(`${receipt.invoiceNumber}`, { continued: true });
    doc.text(new Date(receipt.issuedAt).toLocaleString('en-IN'), { align: 'right' });
    if (receipt.status === 'CANCELLED') {
      doc.font('Helvetica-Bold').fillColor('red').text('*** CANCELLED ***', { align: 'center' }).fillColor('black');
    }
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(7);
    doc.text('Item', 18, doc.y, { continued: true, width: 120 });
    doc.text('Qty', { continued: true, width: 30, align: 'right' });
    doc.text('Amount', { align: 'right' });
    doc.font('Helvetica');
    for (const item of receipt.sale.items) {
      doc.text(item.productNameSnapshot, 18, doc.y, { continued: true, width: 120 });
      doc.text(String(item.quantity), { continued: true, width: 30, align: 'right' });
      doc.text(rupees(item.lineTotalPaise), { align: 'right' });
    }
    doc.moveDown(0.5);

    doc.text(`Subtotal: ${rupees(receipt.sale.subtotalPaise)}`, { align: 'right' });
    if (receipt.sale.discountPaise > 0) doc.text(`Discount: -${rupees(receipt.sale.discountPaise)}`, { align: 'right' });
    if (receipt.sale.taxPaise > 0) doc.text(`Tax: ${rupees(receipt.sale.taxPaise)}`, { align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9).text(`TOTAL: ${rupees(receipt.sale.totalPaise)}`, { align: 'right' });
    doc.font('Helvetica').fontSize(7);
    doc.text(`Paid via: ${receipt.sale.payments.map((p) => p.method).join(', ')}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.text('Thank you for shopping with us!', { align: 'center' });

    doc.end();
    return done;
  }

  /**
   * Full receipt payload for one invoice (design doc 0009). Snapshots only,
   * cost/profit fields deliberately never mapped. `_storeId` is internal —
   * callers strip it after their own authorization check.
   */
  private async loadReceipt(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        sale: {
          include: {
            items: true,
            payments: true,
            customer: { select: { name: true, phone: true } },
          },
        },
      },
    });

    if (!invoice) return null;

    return {
      _storeId: invoice.storeId,
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      financialYear: invoice.financialYear,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      // Buyer identity for the wa.me direct chat — stripped from the PUBLIC
      // payload (the /r/ link may be forwarded; viewers must not see it).
      customer: invoice.sale.customer
        ? { name: invoice.sale.customer.name, phone: invoice.sale.customer.phone }
        : null,
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
