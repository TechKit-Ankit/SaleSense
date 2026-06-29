import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
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
}
