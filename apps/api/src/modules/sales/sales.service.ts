import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PrismaService } from '@salesense/db';
import {
  SaleStatus,
  PaymentStatus,
  PaymentRecordStatus,
  StockMovementType,
  StockReferenceType,
  InvoiceStatus,
  Prisma,
} from '@salesense/db';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async createSale(storeId: string, cashierUserId: string, dto: CreateSaleDto, requestId: string) {
    // 1. Check idempotency
    const existing = await this.prisma.sale.findUnique({
      where: { storeId_idempotencyKey: { storeId, idempotencyKey: dto.idempotencyKey } },
      include: { items: true, payments: true, invoice: true },
    });
    if (existing) {
      return existing; // Already processed
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Fetch Store for snapshotting
        const store = await tx.store.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');

        let subtotalPaise = 0n;
        let discountPaise = 0n;
        let taxPaise = 0n;
        let totalPaise = 0n;
        let profitPaise = 0n;

        const saleItemsInput: Prisma.SaleItemUncheckedCreateWithoutSaleInput[] = [];
        const stockMovementsInput: Prisma.StockMovementUncheckedCreateInput[] = [];

        // 2. Process Items
        for (const itemDto of dto.items) {
          const product = await tx.product.findUnique({ where: { id: itemDto.productId } });
          if (!product) throw new BadRequestException(`Product ${itemDto.productId} not found`);

          let unitPurchasePricePaise = 0n;
          let batchId = itemDto.batchId;

          if (batchId) {
            const batch = await tx.inventoryBatch.findUnique({ where: { id: batchId } });
            if (!batch) throw new BadRequestException(`Batch ${batchId} not found`);
            
            unitPurchasePricePaise = batch.purchasePricePaise ?? 0n;

            // Deduct stock
            const newQty = batch.currentQuantity - itemDto.quantity;
            await tx.inventoryBatch.update({
              where: { id: batchId },
              data: { currentQuantity: newQty },
            });

            // We need the stock movement but we don't have saleId yet. 
            // We will create the movements after the Sale is created.
          }

          const lineDiscount = BigInt(itemDto.discountPaise || 0);
          const lineGross = BigInt(itemDto.unitSellingPricePaise) * BigInt(itemDto.quantity);
          const lineTax = (lineGross * BigInt(product.taxRateBps)) / 10000n;
          const lineTotal = lineGross - lineDiscount + lineTax;
          
          const lineCost = unitPurchasePricePaise * BigInt(itemDto.quantity);
          const lineProfit = lineTotal - lineTax - lineCost;

          subtotalPaise += lineGross;
          discountPaise += lineDiscount;
          taxPaise += lineTax;
          totalPaise += lineTotal;
          profitPaise += lineProfit;

          saleItemsInput.push({
            storeId,
            productId: product.id,
            batchId: batchId ?? null,
            productNameSnapshot: product.name,
            barcodeSnapshot: null, // Could map from barcode table if needed
            hsnCodeSnapshot: product.hsnCode,
            quantity: itemDto.quantity,
            unitPurchasePricePaise,
            unitSellingPricePaise: BigInt(itemDto.unitSellingPricePaise),
            discountPaise: lineDiscount,
            taxRateBps: product.taxRateBps,
            taxPaise: lineTax,
            lineTotalPaise: lineTotal,
            profitPaise: lineProfit,
          });
        }

        // 3. Process Payments
        let paidAmount = 0n;
        const paymentsInput: Prisma.PaymentUncheckedCreateWithoutSaleInput[] = dto.payments.map(p => {
          paidAmount += BigInt(p.amountPaise);
          return {
            storeId,
            method: p.method,
            amountPaise: p.amountPaise,
            status: PaymentRecordStatus.SUCCESS,
            paidAt: new Date(),
          };
        });

        const paymentStatus = paidAmount >= totalPaise ? PaymentStatus.PAID : 
                             (paidAmount > 0n ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID);

        // 4. Generate Invoice Sequence
        const financialYear = new Date().getFullYear().toString();
        const sequence = await tx.invoiceSequence.upsert({
          where: { storeId_financialYear: { storeId, financialYear } },
          create: { storeId, financialYear, prefix: 'INV', nextNumber: 1 },
          update: { nextNumber: { increment: 1 } },
        });
        const invoiceNumber = `${sequence.prefix}-${financialYear}-${sequence.nextNumber.toString().padStart(5, '0')}`;

        // 5. Create Sale
        const sale = await tx.sale.create({
          data: {
            storeId,
            customerId: dto.customerId ?? null,
            cashierUserId,
            deviceId: dto.deviceId ?? null,
            idempotencyKey: dto.idempotencyKey,
            clientSaleId: dto.clientSaleId ?? null,
            status: SaleStatus.COMPLETED,
            subtotalPaise,
            discountPaise,
            taxPaise,
            totalPaise,
            profitPaise,
            paymentStatus,
            saleSource: dto.saleSource,
            createdRequestId: requestId ?? null,
            items: { create: saleItemsInput },
            payments: { create: paymentsInput },
            invoice: {
              create: {
                storeId,
                invoiceNumber,
                financialYear,
                status: InvoiceStatus.ISSUED,
                storeNameSnapshot: store.name,
                gstNumberSnapshot: store.gstNumber,
                storeAddressSnapshot: store.addressLine1,
                createdRequestId: requestId ?? null,
              }
            }
          },
          include: { items: true, payments: true, invoice: true },
        });

        // 6. Create StockMovements referencing the sale
        for (const item of sale.items) {
          if (item.batchId) {
            // fetch updated batch qty for 'quantityAfter'
            const batch = await tx.inventoryBatch.findUnique({ where: { id: item.batchId } });
            await tx.stockMovement.create({
              data: {
                storeId,
                productId: item.productId,
                batchId: item.batchId,
                type: StockMovementType.SALE_OUT,
                quantityDelta: -item.quantity,
                quantityAfter: batch?.currentQuantity ?? 0,
                referenceType: StockReferenceType.SALE,
                referenceId: sale.id,
                createdByUserId: cashierUserId,
                createdRequestId: requestId ?? null,
              }
            });
          }
        }

        return sale;
      },
      { timeout: 10000, maxWait: 10000 }
    );
  }

  async syncSales(storeId: string, cashierUserId: string, dtos: CreateSaleDto[], requestId: string) {
    const results = { synced: [], failed: [] };
    
    for (const dto of dtos) {
      try {
        const sale = await this.createSale(storeId, cashierUserId, dto, requestId);
        // @ts-ignore
        results.synced.push({ clientSaleId: dto.clientSaleId, saleId: sale.id, invoiceId: sale.invoice?.id });
      } catch (e: any) {
        // @ts-ignore
        results.failed.push({ clientSaleId: dto.clientSaleId, error: e.message });
      }
    }

    return results;
  }
}
