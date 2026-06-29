import { Test, TestingModule } from '@nestjs/testing';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '@salesense/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrderStatus, StockMovementType, StockReferenceType, BatchStatus } from '@salesense/db';

const mockPrismaService = {
  purchaseOrder: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockTx)),
};

const mockTx = {
  purchaseOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  inventoryBatch: {
    create: jest.fn(),
  },
  stockMovement: {
    create: jest.fn(),
  },
};

describe('PurchasesService', () => {
  let service: PurchasesService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('receive', () => {
    it('should throw BadRequestException if not DRAFT', async () => {
      mockTx.purchaseOrder.findUnique.mockResolvedValue({ 
        id: 'po_1', 
        storeId: 'store_1', 
        status: PurchaseOrderStatus.RECEIVED,
        items: [] 
      });
      await expect(service.receive('store_1', 'user_1', 'po_1')).rejects.toThrow(BadRequestException);
    });

    it('should receive successfully and create batches', async () => {
      mockTx.purchaseOrder.findUnique.mockResolvedValue({ 
        id: 'po_1', 
        storeId: 'store_1', 
        status: PurchaseOrderStatus.DRAFT,
        items: [
          {
            id: 'item_1',
            productId: 'prod_1',
            quantity: 10,
            purchasePricePaise: 1000,
            sellingPricePaise: 1500,
          }
        ] 
      });

      mockTx.purchaseOrder.update.mockResolvedValue({ id: 'po_1', status: PurchaseOrderStatus.RECEIVED });
      mockTx.inventoryBatch.create.mockResolvedValue({ id: 'batch_1' });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'mov_1' });

      const result = await service.receive('store_1', 'user_1', 'po_1');
      
      expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
      expect(mockTx.inventoryBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          productId: 'prod_1',
          purchaseItemId: 'item_1',
          initialQuantity: 10,
          currentQuantity: 10,
          status: BatchStatus.ACTIVE,
        })
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          productId: 'prod_1',
          batchId: 'batch_1',
          type: StockMovementType.PURCHASE_IN,
          quantityDelta: 10,
          referenceType: StockReferenceType.PURCHASE,
          referenceId: 'po_1',
        })
      });
    });
  });
});
