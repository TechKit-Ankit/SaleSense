import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PrismaService } from '@salesense/db';
import { PurchaseOrderStatus, StockMovementType, StockReferenceType, Prisma, BatchStatus } from '@salesense/db';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, userId: string, dto: CreatePurchaseDto) {
    const data: Prisma.PurchaseOrderUncheckedCreateInput = {
      storeId,
      createdByUserId: userId,
      purchaseDate: new Date(dto.purchaseDate),
      subtotalPaise: dto.subtotalPaise,
      taxPaise: dto.taxPaise,
      totalPaise: dto.totalPaise,
      status: PurchaseOrderStatus.DRAFT,
      items: {
        create: dto.items.map((item) => {
          const itemData: Prisma.PurchaseItemUncheckedCreateWithoutPurchaseOrderInput = {
            storeId,
            productId: item.productId,
            quantity: item.quantity,
            purchasePricePaise: item.purchasePricePaise,
            sellingPricePaise: item.sellingPricePaise,
            lineTotalPaise: item.quantity * item.purchasePricePaise, // simplified
          };
          if (item.mrpPaise !== undefined) itemData.mrpPaise = item.mrpPaise ?? null;
          if (item.taxRateBps !== undefined) itemData.taxRateBps = item.taxRateBps;
          if (item.batchNo !== undefined) itemData.batchNo = item.batchNo ?? null;
          if (item.expiryDate !== undefined) itemData.expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
          return itemData;
        }),
      },
    };

    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId ?? null;
    if (dto.invoiceNumber !== undefined) data.invoiceNumber = dto.invoiceNumber ?? null;

    return this.prisma.purchaseOrder.create({
      data,
      include: { items: true },
    });
  }

  async findAll(storeId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { storeId },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(storeId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } },
    });

    if (!order || order.storeId !== storeId) {
      throw new NotFoundException('Purchase order not found');
    }
    return order;
  }

  async receive(storeId: string, userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order || order.storeId !== storeId) {
        throw new NotFoundException('Purchase order not found');
      }

      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT purchase orders can be received');
      }

      // 1. Mark as received
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.RECEIVED },
      });

      // 2. Inject stock for each item
      for (const item of order.items) {
        // Create batch
        const batchData: Prisma.InventoryBatchUncheckedCreateInput = {
          storeId,
          productId: item.productId,
          purchaseItemId: item.id,
          batchNo: item.batchNo,
          purchasePricePaise: item.purchasePricePaise,
          mrpPaise: item.mrpPaise,
          sellingPricePaise: item.sellingPricePaise,
          expiryDate: item.expiryDate,
          initialQuantity: item.quantity,
          currentQuantity: item.quantity,
          status: BatchStatus.ACTIVE,
          createdByUserId: userId,
        };

        const batch = await tx.inventoryBatch.create({
          data: batchData,
        });

        // Create movement
        const movementData: Prisma.StockMovementUncheckedCreateInput = {
          storeId,
          productId: item.productId,
          batchId: batch.id,
          type: StockMovementType.PURCHASE_IN,
          quantityDelta: item.quantity,
          quantityAfter: item.quantity,
          referenceType: StockReferenceType.PURCHASE,
          referenceId: order.id,
          createdByUserId: userId,
        };

        await tx.stockMovement.create({
          data: movementData,
        });
      }

      return updatedOrder;
    });
  }
}
