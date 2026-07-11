import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ResolveReconciliationDto, ReconciliationAction } from './dto/resolve-reconciliation.dto';
import { PrismaService } from '@salesense/db';
import { StockMovementType, StockReferenceType } from '@salesense/db';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getOverview(storeId: string) {
    // Return all active batches with their product info
    return this.prisma.inventoryBatch.findMany({
      where: { storeId, currentQuantity: { gt: 0 } },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMovements(storeId: string, productId?: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        storeId,
        ...(productId ? { productId } : {}),
      },
      include: {
        product: true,
        createdByUser: {
          select: { id: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit for performance in MVP
    });
  }

  async createAdjustment(
    storeId: string,
    userId: string,
    dto: CreateStockAdjustmentDto,
    requestId?: string,
  ) {
    if (dto.quantityDelta === 0) {
      throw new BadRequestException('Quantity delta cannot be zero');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify batch exists and belongs to the store & product
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: dto.batchId },
      });

      if (!batch || batch.storeId !== storeId || batch.productId !== dto.productId) {
        throw new NotFoundException('Inventory batch not found or invalid');
      }

      // 2. Create StockAdjustment record
      const adjustment = await tx.stockAdjustment.create({
        data: {
          storeId,
          productId: dto.productId,
          batchId: dto.batchId,
          quantityDelta: dto.quantityDelta,
          reason: dto.reason,
          createdByUserId: userId,
          createdRequestId: requestId ?? null,
        },
      });

      // 3. Create StockMovement record
      const type = dto.quantityDelta > 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT;
      const quantityAfter = batch.currentQuantity + dto.quantityDelta;

      await tx.stockMovement.create({
        data: {
          storeId,
          productId: dto.productId,
          batchId: dto.batchId,
          type,
          quantityDelta: dto.quantityDelta,
          quantityAfter,
          referenceType: StockReferenceType.ADJUSTMENT,
          referenceId: adjustment.id,
          reason: dto.reason,
          createdByUserId: userId,
          createdRequestId: requestId ?? null,
        },
      });

      // 4. Update InventoryBatch
      return tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          currentQuantity: quantityAfter,
        },
      });
    });
  }

  /**
   * Lists stock movements flagged for reconciliation (offline oversells).
   * Includes the LIVE batch quantity so a physical count can be compared
   * against current reality, not the state at flag time.
   * See system-design/0005-inventory-reconciliation-design.md.
   */
  async getReconciliationList(storeId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { storeId, requiresReconciliation: true },
      include: {
        product: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNo: true, currentQuantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // exception workflow — small by nature; cursor pagination later if needed
    });

    return movements.map((m) => ({
      movementId: m.id,
      type: m.type,
      quantityDelta: m.quantityDelta,
      quantityAfter: m.quantityAfter,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      createdAt: m.createdAt,
      product: m.product ? { id: m.product.id, name: m.product.name } : null,
      batch: m.batch
        ? { id: m.batch.id, batchNo: m.batch.batchNo, currentQuantity: m.batch.currentQuantity }
        : null,
    }));
  }

  /**
   * Resolves one flagged movement in a single transaction:
   * - ADJUST: corrective StockAdjustment + StockMovement, batch set to the
   *   physically counted quantity, flag cleared, audit log.
   * - DISMISS: flag cleared + audit log only.
   * Clearing the flag never rewrites stock deltas — the ledger stays immutable.
   */
  async resolveReconciliation(
    storeId: string,
    userId: string,
    movementId: string,
    dto: ResolveReconciliationDto,
    requestId?: string,
  ) {
    if (dto.action === ReconciliationAction.ADJUST && dto.countedQuantity === undefined) {
      throw new BadRequestException('countedQuantity is required when action is ADJUST');
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUnique({ where: { id: movementId } });

      // Already-resolved or foreign movements are "not found" — idempotent-safe
      // for double-clicks and safe against cross-store probing.
      if (!movement || movement.storeId !== storeId || !movement.requiresReconciliation) {
        throw new NotFoundException('Reconciliation item not found');
      }
      if (!movement.batchId) {
        throw new BadRequestException('Movement has no batch to reconcile');
      }

      let adjustment = null;

      if (dto.action === ReconciliationAction.ADJUST) {
        const batch = await tx.inventoryBatch.findUnique({ where: { id: movement.batchId } });
        if (!batch) throw new NotFoundException('Inventory batch not found');

        const delta = dto.countedQuantity! - batch.currentQuantity;

        // delta = 0 means the count matches the system — behaves like DISMISS.
        if (delta !== 0) {
          adjustment = await tx.stockAdjustment.create({
            data: {
              storeId,
              productId: movement.productId,
              batchId: movement.batchId,
              quantityDelta: delta,
              reason: dto.reason,
              createdByUserId: userId,
              createdRequestId: requestId ?? null,
            },
          });

          await tx.stockMovement.create({
            data: {
              storeId,
              productId: movement.productId,
              batchId: movement.batchId,
              type: delta > 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
              quantityDelta: delta,
              quantityAfter: dto.countedQuantity!,
              referenceType: StockReferenceType.ADJUSTMENT,
              referenceId: adjustment.id,
              reason: dto.reason,
              createdByUserId: userId,
              createdRequestId: requestId ?? null,
            },
          });

          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: { currentQuantity: dto.countedQuantity! },
          });
        }
      }

      const resolved = await tx.stockMovement.update({
        where: { id: movementId },
        data: { requiresReconciliation: false },
      });

      await tx.auditLog.create({
        data: {
          requestId: requestId ?? null,
          actorUserId: userId,
          storeId,
          action: 'RECONCILIATION_RESOLVED',
          entityType: 'stock_movement',
          entityId: movementId,
          metadata: {
            action: dto.action,
            reason: dto.reason,
            countedQuantity: dto.countedQuantity ?? null,
            adjustmentId: adjustment?.id ?? null,
          },
        },
      });

      return { movement: resolved, adjustment };
    });
  }
}
