import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import {
  RefundStatus,
  SaleStatus,
  PaymentStatus,
  StockMovementType,
  StockReferenceType,
} from '@salesense/db';
import { BusinessException } from '../../common/errors/business-exception.js';
import {
  RESOURCE_NOT_FOUND,
  SALE_ALREADY_PROCESSED,
  REFUND_APPROVAL_REQUIRED,
  ERROR_CODE_HTTP_STATUS,
} from '../../common/errors/error-codes.js';
import { CreateRefundDto } from './dto/create-refund.dto.js';

/** Refund statuses that reserve refundable quantity (design doc 0011 rule 1). */
const RESERVING_STATUSES: RefundStatus[] = [
  RefundStatus.PENDING_APPROVAL,
  RefundStatus.APPROVED,
  RefundStatus.COMPLETED,
];

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  private notFound(what: string): never {
    throw new BusinessException(
      RESOURCE_NOT_FOUND,
      `${what} was not found.`,
      ERROR_CODE_HTTP_STATUS[RESOURCE_NOT_FOUND] ?? 404,
    );
  }

  /**
   * Creates a PENDING_APPROVAL refund request. Amounts are computed
   * server-side — proportional shares of each line's total (which already
   * embeds discount and tax); BigInt floor favors the store (design 0011).
   */
  async requestRefund(storeId: string, userId: string, saleId: string, dto: CreateRefundDto, requestId?: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        refunds: { include: { items: true } },
      },
    });

    if (!sale || sale.storeId !== storeId) this.notFound('Sale');
    if (sale.status !== SaleStatus.COMPLETED && sale.status !== SaleStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException(`Sale with status ${sale.status} cannot be refunded`);
    }

    // Reserved quantities: every refund not REJECTED/CANCELLED holds its units.
    const reserved = new Map<string, number>();
    for (const refund of sale.refunds) {
      if (!RESERVING_STATUSES.includes(refund.status)) continue;
      for (const ri of refund.items) {
        reserved.set(ri.saleItemId, (reserved.get(ri.saleItemId) ?? 0) + ri.quantity);
      }
    }

    let refundAmountPaise = 0n;
    const itemsInput = dto.items.map((input) => {
      const saleItem = sale.items.find((i) => i.id === input.saleItemId);
      if (!saleItem) {
        throw new BadRequestException(`Sale item ${input.saleItemId} does not belong to this sale`);
      }
      const refundable = saleItem.quantity - (reserved.get(saleItem.id) ?? 0);
      if (input.quantity > refundable) {
        throw new BadRequestException(
          `Only ${refundable} unit(s) of ${saleItem.productNameSnapshot} are refundable (requested ${input.quantity})`,
        );
      }

      // Proportional share of the line total (discount+tax included), floored.
      const amount = (saleItem.lineTotalPaise * BigInt(input.quantity)) / BigInt(saleItem.quantity);
      refundAmountPaise += amount;

      return {
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        batchId: saleItem.batchId,
        quantity: input.quantity,
        refundAmountPaise: amount,
        restock: input.restock ?? true,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          storeId,
          saleId: sale.id,
          reason: dto.reason,
          refundAmountPaise,
          status: RefundStatus.PENDING_APPROVAL,
          createdByUserId: userId,
          createdRequestId: requestId ?? null,
          items: { create: itemsInput },
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: {
          requestId: requestId ?? null,
          actorUserId: userId,
          storeId,
          action: 'REFUND_REQUESTED',
          entityType: 'refund',
          entityId: refund.id,
          metadata: { saleId: sale.id, refundAmountPaise: Number(refundAmountPaise), reason: dto.reason },
        },
      });

      return refund;
    });
  }

  async listRefunds(storeId: string) {
    return this.prisma.refund.findMany({
      where: { storeId },
      include: {
        sale: { select: { id: true, createdAt: true, totalPaise: true, invoice: { select: { invoiceNumber: true } } } },
        items: { select: { quantity: true } },
        createdByUser: { select: { id: true, name: true } },
        approvedByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getRefund(storeId: string, refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        items: { include: { saleItem: { select: { productNameSnapshot: true } } } },
        sale: { select: { id: true, createdAt: true, totalPaise: true, invoice: { select: { invoiceNumber: true } } } },
        createdByUser: { select: { id: true, name: true } },
        approvedByUser: { select: { id: true, name: true } },
      },
    });
    if (!refund || refund.storeId !== storeId) this.notFound('Refund');
    return refund;
  }

  /** PENDING_APPROVAL → APPROVED (state machine IS the idempotency, design 0011 rule 5). */
  async approve(storeId: string, userId: string, refundId: string, requestId?: string) {
    return this.transition(storeId, userId, refundId, requestId, RefundStatus.APPROVED, 'REFUND_APPROVED');
  }

  /** PENDING_APPROVAL → REJECTED — releases the reserved quantities. */
  async reject(storeId: string, userId: string, refundId: string, requestId?: string) {
    return this.transition(storeId, userId, refundId, requestId, RefundStatus.REJECTED, 'REFUND_REJECTED');
  }

  private async transition(
    storeId: string,
    userId: string,
    refundId: string,
    requestId: string | undefined,
    to: RefundStatus,
    auditAction: string,
  ) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund || refund.storeId !== storeId) this.notFound('Refund');
    if (refund.status !== RefundStatus.PENDING_APPROVAL) {
      throw new BusinessException(
        SALE_ALREADY_PROCESSED,
        `Refund is ${refund.status}, not pending approval`,
        ERROR_CODE_HTTP_STATUS[SALE_ALREADY_PROCESSED] ?? 409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.refund.update({
        where: { id: refundId },
        data: { status: to, approvedByUserId: userId, approvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          requestId: requestId ?? null,
          actorUserId: userId,
          storeId,
          action: auditAction,
          entityType: 'refund',
          entityId: refundId,
          metadata: { saleId: refund.saleId },
        },
      });
      return updated;
    });
  }

  /**
   * APPROVED → COMPLETED in one transaction — the sale transaction in
   * reverse (design 0011 rule 4): restock batches + REFUND_IN movements,
   * then the sale's status/paymentStatus progression, plus audit.
   */
  async complete(storeId: string, userId: string, refundId: string, requestId?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { items: true, sale: { include: { items: true } } },
    });
    if (!refund || refund.storeId !== storeId) this.notFound('Refund');
    if (refund.status !== RefundStatus.APPROVED) {
      throw new BusinessException(
        REFUND_APPROVAL_REQUIRED,
        `Refund is ${refund.status} — it must be APPROVED before completion`,
        ERROR_CODE_HTTP_STATUS[REFUND_APPROVAL_REQUIRED] ?? 409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Restock: only items flagged restock AND sold from a batch.
      for (const item of refund.items) {
        if (!item.restock || !item.batchId) continue;
        const batch = await tx.inventoryBatch.findUnique({ where: { id: item.batchId } });
        if (!batch) continue; // batch archived — stock adjustment is the manual fallback
        const newQty = batch.currentQuantity + item.quantity;
        await tx.inventoryBatch.update({ where: { id: batch.id }, data: { currentQuantity: newQty } });
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: item.productId,
            batchId: item.batchId,
            type: StockMovementType.REFUND_IN,
            quantityDelta: item.quantity,
            quantityAfter: newQty,
            referenceType: StockReferenceType.REFUND,
            referenceId: refund.id,
            reason: refund.reason,
            createdByUserId: userId,
            createdRequestId: requestId ?? null,
          },
        });
      }

      // 2. Mark completed.
      const completed = await tx.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.COMPLETED },
        include: { items: true },
      });

      // 3. Sale progression: fully refunded when every sold unit is in a
      //    COMPLETED refund (including this one).
      const completedItems = await tx.refundItem.findMany({
        where: { refund: { saleId: refund.saleId, status: RefundStatus.COMPLETED } },
        select: { quantity: true },
      });
      const refundedQty = completedItems.reduce((sum, i) => sum + i.quantity, 0);
      const soldQty = refund.sale.items.reduce((sum, i) => sum + i.quantity, 0);
      const fullyRefunded = refundedQty >= soldQty;

      await tx.sale.update({
        where: { id: refund.saleId },
        data: {
          status: fullyRefunded ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED,
          ...(fullyRefunded ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          requestId: requestId ?? null,
          actorUserId: userId,
          storeId,
          action: 'REFUND_COMPLETED',
          entityType: 'refund',
          entityId: refundId,
          metadata: {
            saleId: refund.saleId,
            refundAmountPaise: Number(refund.refundAmountPaise),
            fullyRefunded,
          },
        },
      });

      return completed;
    });
  }
}
