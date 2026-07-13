import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PrismaService } from '@salesense/db';
import {
  SaleStatus,
  SaleSource,
  SyncStatus,
  PaymentStatus,
  PaymentRecordStatus,
  StockMovementType,
  StockReferenceType,
  InvoiceStatus,
  Prisma,
} from '@salesense/db';
import { BusinessException } from '../../common/errors/business-exception.js';
import {
  INSUFFICIENT_STOCK,
  ERROR_CODE_HTTP_STATUS,
  STOCK_RECONCILIATION_REQUIRED,
  INTERNAL_ERROR,
  RESOURCE_NOT_FOUND,
} from '../../common/errors/error-codes.js';

/**
 * Returns the Indian financial year label (April–March) for a given date,
 * e.g. `2026-2027`. Used for per-store, per-FY invoice numbering as specified
 * in the database model and API design.
 */
export function getIndianFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January
  const startYear = month >= 3 ? year : year - 1; // FY starts in April (month index 3)
  return `${startYear}-${startYear + 1}`;
}

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

    try {
      return await this.prisma.$transaction(
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

            // Online stock guard: block overselling for live sales unless the
            // store opts into negative stock. Offline sync is intentionally
            // allowed to oversell and is reconciled afterwards (see design docs).
            if (
              dto.saleSource !== SaleSource.OFFLINE_SYNC &&
              !store.allowNegativeStock &&
              batch.currentQuantity < itemDto.quantity
            ) {
              throw new BusinessException(
                INSUFFICIENT_STOCK,
                'Insufficient stock for this product.',
                ERROR_CODE_HTTP_STATUS[INSUFFICIENT_STOCK] ?? 409,
                {
                  productId: itemDto.productId,
                  availableQuantity: batch.currentQuantity,
                },
              );
            }

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
        const financialYear = getIndianFinancialYear(new Date());
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

        // 6. Write audit log for the sale creation (safe metadata only).
        await tx.auditLog.create({
          data: {
            requestId: requestId ?? null,
            actorUserId: cashierUserId,
            storeId,
            action: 'SALE_CREATED',
            entityType: 'sale',
            entityId: sale.id,
            metadata: {
              invoiceId: sale.invoice?.id ?? null,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });

        // 7. Create StockMovements referencing the sale
        for (const item of sale.items) {
          if (item.batchId) {
            // fetch updated batch qty for 'quantityAfter'
            const batch = await tx.inventoryBatch.findUnique({ where: { id: item.batchId } });
            const afterQty = batch?.currentQuantity ?? 0;
            await tx.stockMovement.create({
              data: {
                storeId,
                productId: item.productId,
                batchId: item.batchId,
                type: StockMovementType.SALE_OUT,
                quantityDelta: -item.quantity,
                quantityAfter: afterQty,
                // Stock went negative (only reachable via offline sync or
                // allowNegativeStock) — flag it for owner/manager review.
                requiresReconciliation: afterQty < 0,
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
    } catch (e) {
      // Concurrent duplicate: two identical requests raced past the pre-check
      // and the unique (storeId, idempotencyKey) constraint rejected the second.
      // Return the sale the winning request created instead of a 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.sale.findUnique({
          where: { storeId_idempotencyKey: { storeId, idempotencyKey: dto.idempotencyKey } },
          include: { items: true, payments: true, invoice: true },
        });
        if (winner) return winner;
      }
      throw e;
    }
  }

  /** Latest sales for the history page (design doc 0011). */
  async listSales(storeId: string) {
    return this.prisma.sale.findMany({
      where: { storeId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        refunds: { select: { id: true, status: true, refundAmountPaise: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // MVP limit, consistent with movements/reconciliation
    });
  }

  /**
   * Sale detail with per-item `refundableQuantity` precomputed: sold minus
   * every refund quantity that is not REJECTED/CANCELLED — pending requests
   * reserve refundability (design doc 0011 rule 1).
   */
  async getSale(storeId: string, saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        invoice: { select: { id: true, invoiceNumber: true } },
        refunds: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!sale || sale.storeId !== storeId) {
      throw new BusinessException(
        RESOURCE_NOT_FOUND,
        'Sale was not found.',
        ERROR_CODE_HTTP_STATUS[RESOURCE_NOT_FOUND] ?? 404,
      );
    }

    const reserved = new Map<string, number>();
    for (const refund of sale.refunds) {
      if (refund.status === 'REJECTED' || refund.status === 'CANCELLED') continue;
      for (const ri of refund.items) {
        reserved.set(ri.saleItemId, (reserved.get(ri.saleItemId) ?? 0) + ri.quantity);
      }
    }

    return {
      ...sale,
      items: sale.items.map((item) => ({
        ...item,
        refundableQuantity: item.quantity - (reserved.get(item.id) ?? 0),
      })),
    };
  }

  async syncSales(storeId: string, cashierUserId: string, dtos: CreateSaleDto[], requestId: string) {
    const synced: SyncedSaleResult[] = [];
    const failed: FailedSaleResult[] = [];

    for (const dto of dtos) {
      const clientMutationId = dto.clientSaleId ?? dto.idempotencyKey;
      try {
        const sale = await this.createSale(storeId, cashierUserId, dto, requestId);

        // A completed offline sale is never rejected; if it drove stock
        // negative we flag it for reconciliation and warn the client.
        const reconCount = await this.prisma.stockMovement.count({
          where: {
            storeId,
            referenceType: StockReferenceType.SALE,
            referenceId: sale.id,
            requiresReconciliation: true,
          },
        });
        const requiresReconciliation = reconCount > 0;

        await this.recordSyncEvent(storeId, cashierUserId, dto, {
          entityId: sale.id,
          status: SyncStatus.SYNCED,
          requiresReconciliation,
          requestId,
        });

        synced.push({
          clientSaleId: dto.clientSaleId ?? null,
          clientMutationId,
          saleId: sale.id,
          invoiceId: sale.invoice?.id ?? null,
          status: SyncStatus.SYNCED,
          requiresReconciliation,
          warnings: requiresReconciliation
            ? [
                {
                  code: STOCK_RECONCILIATION_REQUIRED,
                  message: 'Sale synced, but stock is now negative for one or more items.',
                },
              ]
            : [],
        });
      } catch (e: unknown) {
        const code = e instanceof BusinessException ? e.code : INTERNAL_ERROR;
        const message =
          e instanceof BusinessException
            ? e.message
            : 'Sync failed for this sale. It remains queued for retry.';

        // Best-effort: never let sync-event bookkeeping mask the real failure.
        await this.recordSyncEvent(storeId, cashierUserId, dto, {
          entityId: null,
          status: SyncStatus.FAILED,
          requiresReconciliation: false,
          requestId,
          error: { code, message },
        }).catch(() => undefined);

        failed.push({
          clientSaleId: dto.clientSaleId ?? null,
          clientMutationId,
          status: SyncStatus.FAILED,
          error: { code, message },
        });
      }
    }

    return { synced, failed };
  }

  /**
   * Upserts a `sync_events` row for one offline mutation. Keyed by the client
   * mutation id so retries update the same row (incrementing attemptCount)
   * rather than duplicating it.
   */
  private async recordSyncEvent(
    storeId: string,
    userId: string,
    dto: CreateSaleDto,
    opts: {
      entityId: string | null;
      status: SyncStatus;
      requiresReconciliation: boolean;
      requestId: string;
      error?: { code: string; message: string };
    },
  ): Promise<void> {
    const clientMutationId = dto.clientSaleId ?? dto.idempotencyKey;
    const deviceId = dto.deviceId ?? null;

    const existing = await this.prisma.syncEvent.findFirst({
      where: { storeId, deviceId, clientMutationId },
    });

    const data = {
      requestId: opts.requestId ?? null,
      storeId,
      deviceId,
      userId: userId ?? null,
      clientMutationId,
      entityType: 'sale',
      entityId: opts.entityId,
      status: opts.status,
      requiresReconciliation: opts.requiresReconciliation,
      lastErrorCode: opts.error?.code ?? null,
      lastErrorMessage: opts.error?.message ?? null,
      syncedAt: opts.status === SyncStatus.SYNCED ? new Date() : null,
    };

    if (existing) {
      await this.prisma.syncEvent.update({
        where: { id: existing.id },
        data: { ...data, attemptCount: existing.attemptCount + 1 },
      });
    } else {
      await this.prisma.syncEvent.create({ data: { ...data, attemptCount: 1 } });
    }
  }
}

export interface SyncWarning {
  code: string;
  message: string;
}

export interface SyncedSaleResult {
  clientSaleId: string | null;
  clientMutationId: string;
  saleId: string;
  invoiceId: string | null;
  status: SyncStatus;
  requiresReconciliation: boolean;
  warnings: SyncWarning[];
}

export interface FailedSaleResult {
  clientSaleId: string | null;
  clientMutationId: string;
  status: SyncStatus;
  error: { code: string; message: string };
}
