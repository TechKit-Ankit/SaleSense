import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '@salesense/db';
import { SaleSource, PaymentMethod, SaleStatus } from '@salesense/db';
import { BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  sale: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockTx)),
};

const mockTx = {
  store: { findUnique: jest.fn() },
  product: { findUnique: jest.fn() },
  inventoryBatch: { findUnique: jest.fn(), update: jest.fn() },
  invoiceSequence: { upsert: jest.fn() },
  sale: { create: jest.fn() },
  stockMovement: { create: jest.fn() },
};

describe('SalesService', () => {
  let service: SalesService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSale', () => {
    it('should return early if idempotency key exists', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue({ id: 'existing_sale' });
      const result = await service.createSale('store_1', 'user_1', {
        idempotencyKey: 'idem_1',
        saleSource: SaleSource.ONLINE,
        items: [],
        payments: [],
      }, 'req_1');
      expect(result).toEqual({ id: 'existing_sale' });
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should process a valid sale', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1' });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 1000, name: 'Prod' }); // 10% tax
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 10, purchasePricePaise: 50n });
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_1', items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 2 }] });

      const dto = {
        idempotencyKey: 'idem_1',
        saleSource: SaleSource.ONLINE,
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 2, unitSellingPricePaise: 100, discountPaise: 0 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 220 }], // 100 * 2 = 200 gross + 20 tax = 220
      };

      const result = await service.createSale('store_1', 'user_1', dto, 'req_1');
      
      expect(result.id).toBe('sale_1');
      expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_1' },
        data: { currentQuantity: 8 },
      });
      expect(mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SaleStatus.COMPLETED,
            subtotalPaise: 200n, // 100 * 2
            taxPaise: 20n, // 10% of 200
            totalPaise: 220n, 
            profitPaise: 100n, // 220 total - 20 tax - 100 cost (50*2)
          })
        })
      );
    });
  });
});
