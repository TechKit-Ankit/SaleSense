import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '@salesense/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockMovementType, StockReferenceType } from '@salesense/db';

const mockPrismaService = {
  inventoryBatch: {
    findMany: jest.fn(),
  },
  stockMovement: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockTx)),
};

const mockTx = {
  inventoryBatch: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  stockAdjustment: {
    create: jest.fn(),
  },
  stockMovement: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAdjustment', () => {
    it('should throw BadRequestException if delta is zero', async () => {
      const dto = { productId: 'p1', batchId: 'b1', quantityDelta: 0, reason: 'test' };
      await expect(service.createAdjustment('store_1', 'user_1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if batch not found', async () => {
      const dto = { productId: 'p1', batchId: 'b1', quantityDelta: 5, reason: 'test' };
      mockTx.inventoryBatch.findUnique.mockResolvedValue(null);
      await expect(service.createAdjustment('store_1', 'user_1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if batch belongs to another store', async () => {
      const dto = { productId: 'p1', batchId: 'b1', quantityDelta: 5, reason: 'test' };
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ storeId: 'store_2', productId: 'p1' });
      await expect(service.createAdjustment('store_1', 'user_1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should create adjustment successfully', async () => {
      const dto = { productId: 'p1', batchId: 'b1', quantityDelta: -5, reason: 'damaged' };
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'b1', storeId: 'store_1', productId: 'p1', currentQuantity: 10 });
      mockTx.stockAdjustment.create.mockResolvedValue({ id: 'adj_1' });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'mov_1' });
      mockTx.inventoryBatch.update.mockResolvedValue({ id: 'b1', currentQuantity: 5 });

      const result = await service.createAdjustment('store_1', 'user_1', dto);
      
      expect(result.currentQuantity).toBe(5);
      expect(mockTx.stockAdjustment.create).toHaveBeenCalledWith({
        data: {
          storeId: 'store_1',
          productId: 'p1',
          batchId: 'b1',
          quantityDelta: -5,
          reason: 'damaged',
          createdByUserId: 'user_1',
          createdRequestId: null,
        }
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          productId: 'p1',
          batchId: 'b1',
          type: StockMovementType.ADJUSTMENT_OUT,
          quantityDelta: -5,
          quantityAfter: 5,
          referenceType: StockReferenceType.ADJUSTMENT,
          referenceId: 'adj_1',
          reason: 'damaged',
          createdByUserId: 'user_1',
          createdRequestId: null,
        })
      });
      expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { currentQuantity: 5 }
      });
    });
  });

  describe('getReconciliationList', () => {
    it('returns only flagged movements with live batch quantity', async () => {
      mockPrismaService.stockMovement.findMany.mockResolvedValue([
        {
          id: 'mov_1',
          type: 'SALE_OUT',
          quantityDelta: -5,
          quantityAfter: -4,
          referenceType: 'SALE',
          referenceId: 'sale_1',
          createdAt: new Date('2026-07-11T10:00:00Z'),
          product: { id: 'p1', name: 'Milk' },
          batch: { id: 'b1', batchNo: 'B-102', currentQuantity: -4 },
        },
      ]);

      const result = await service.getReconciliationList('store_1');

      expect(mockPrismaService.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId: 'store_1', requiresReconciliation: true },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        movementId: 'mov_1',
        product: { id: 'p1', name: 'Milk' },
        batch: { id: 'b1', batchNo: 'B-102', currentQuantity: -4 },
      });
    });
  });

  describe('resolveReconciliation', () => {
    const flagged = {
      id: 'mov_1',
      storeId: 'store_1',
      productId: 'p1',
      batchId: 'b1',
      requiresReconciliation: true,
    };

    it('rejects ADJUST without countedQuantity', async () => {
      await expect(
        service.resolveReconciliation('store_1', 'user_1', 'mov_1', {
          action: 'ADJUST' as any,
          reason: 'count',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for already-resolved or foreign movements', async () => {
      mockTx.stockMovement.findUnique.mockResolvedValue({ ...flagged, requiresReconciliation: false });
      await expect(
        service.resolveReconciliation('store_1', 'user_1', 'mov_1', {
          action: 'DISMISS' as any,
          reason: 'done already',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ADJUST sets batch to counted quantity, creates adjustment + movement, clears flag, audits', async () => {
      mockTx.stockMovement.findUnique.mockResolvedValue(flagged);
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'b1', currentQuantity: -4 });
      mockTx.stockAdjustment.create.mockResolvedValue({ id: 'adj_1' });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'mov_corr' });
      mockTx.stockMovement.update.mockResolvedValue({ ...flagged, requiresReconciliation: false });

      const result = await service.resolveReconciliation('store_1', 'user_1', 'mov_1', {
        action: 'ADJUST' as any,
        countedQuantity: 3,
        reason: 'physical count',
      }, 'req_1');

      // counted 3 vs system -4 → corrective delta +7
      expect(mockTx.stockAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantityDelta: 7 }) }),
      );
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: StockMovementType.ADJUSTMENT_IN,
            quantityDelta: 7,
            quantityAfter: 3,
          }),
        }),
      );
      expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { currentQuantity: 3 },
      });
      expect(mockTx.stockMovement.update).toHaveBeenCalledWith({
        where: { id: 'mov_1' },
        data: { requiresReconciliation: false },
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'RECONCILIATION_RESOLVED' }),
        }),
      );
      expect(result.adjustment).toEqual({ id: 'adj_1' });
    });

    it('DISMISS clears the flag and audits without any stock rows', async () => {
      mockTx.stockMovement.findUnique.mockResolvedValue(flagged);
      mockTx.stockMovement.update.mockResolvedValue({ ...flagged, requiresReconciliation: false });

      const result = await service.resolveReconciliation('store_1', 'user_1', 'mov_1', {
        action: 'DISMISS' as any,
        reason: 'fixed by PO-118',
      });

      expect(mockTx.stockAdjustment.create).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockTx.inventoryBatch.update).not.toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled();
      expect(result.adjustment).toBeNull();
    });
  });
});
