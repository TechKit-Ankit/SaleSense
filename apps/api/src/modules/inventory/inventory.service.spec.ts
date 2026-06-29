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
});
