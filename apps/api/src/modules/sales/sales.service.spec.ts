import { Test, TestingModule } from '@nestjs/testing';
import { SalesService, getIndianFinancialYear } from './sales.service';
import { PrismaService } from '@salesense/db';
import { SaleSource, PaymentMethod, SaleStatus, Prisma } from '@salesense/db';
import { INSUFFICIENT_STOCK } from '../../common/errors/error-codes.js';

const mockPrismaService = {
  sale: {
    findUnique: jest.fn(),
  },
  stockMovement: {
    count: jest.fn(),
  },
  syncEvent: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockTx)),
};

const mockTx = {
  store: { findUnique: jest.fn() },
  customer: { upsert: jest.fn() },
  product: { findUnique: jest.fn() },
  inventoryBatch: { findUnique: jest.fn(), update: jest.fn() },
  invoiceSequence: { upsert: jest.fn() },
  sale: { create: jest.fn() },
  stockMovement: { create: jest.fn() },
  auditLog: { create: jest.fn() },
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
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'SALE_CREATED', entityType: 'sale' }),
        }),
      );
    });

    it('should block an online sale when stock is insufficient', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 1, purchasePricePaise: 50n });

      const dto = {
        idempotencyKey: 'idem_2',
        saleSource: SaleSource.ONLINE,
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 5, unitSellingPricePaise: 100 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 500 }],
      };

      await expect(service.createSale('store_1', 'user_1', dto, 'req_1')).rejects.toMatchObject({
        code: INSUFFICIENT_STOCK,
      });
      expect(mockTx.sale.create).not.toHaveBeenCalled();
    });

    it('should allow overselling when the store enables allowNegativeStock', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: true });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 1, purchasePricePaise: 50n });
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_neg', invoice: null, items: [] });

      const dto = {
        idempotencyKey: 'idem_3',
        saleSource: SaleSource.ONLINE,
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 5, unitSellingPricePaise: 100 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 500 }],
      };

      const result = await service.createSale('store_1', 'user_1', dto, 'req_1');
      expect(result.id).toBe('sale_neg');
      expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_1' },
        data: { currentQuantity: -4 }, // 1 - 5, overselling allowed
      });
    });

    it('captures the customer by phone inside the sale transaction (design 0012)', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 10, purchasePricePaise: 50n });
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.customer.upsert.mockResolvedValue({ id: 'cust_1' });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_c', invoice: { id: 'inv_c' }, items: [] });

      const dto = {
        idempotencyKey: 'idem_cust',
        saleSource: SaleSource.ONLINE,
        customerPhone: '9812345678',
        customerName: 'Asha',
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 1, unitSellingPricePaise: 100 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 100 }],
      };

      await service.createSale('store_1', 'user_1', dto, 'req_1');

      expect(mockTx.customer.upsert).toHaveBeenCalledWith({
        where: { storeId_phone: { storeId: 'store_1', phone: '9812345678' } },
        create: { storeId: 'store_1', phone: '9812345678', name: 'Asha' },
        update: { name: 'Asha' },
      });
      expect(mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ customerId: 'cust_1' }) }),
      );
    });

    it('touches no customer records when no phone is given', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 10, purchasePricePaise: 50n });
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_n', invoice: null, items: [] });

      await service.createSale('store_1', 'user_1', {
        idempotencyKey: 'idem_nocust',
        saleSource: SaleSource.ONLINE,
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 1, unitSellingPricePaise: 100 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 100 }],
      }, 'req_1');

      expect(mockTx.customer.upsert).not.toHaveBeenCalled();
    });

    it('flags the stock movement for reconciliation when offline sync drives stock negative', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
      mockTx.inventoryBatch.findUnique
        .mockResolvedValueOnce({ id: 'batch_1', currentQuantity: 1, purchasePricePaise: 50n }) // item loop
        .mockResolvedValueOnce({ id: 'batch_1', currentQuantity: -4 }); // movement loop (quantityAfter)
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({
        id: 'sale_off',
        invoice: { id: 'inv_off' },
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 5 }],
      });

      const dto = {
        idempotencyKey: 'idem_off',
        clientSaleId: 'c1',
        saleSource: SaleSource.OFFLINE_SYNC, // bypasses the online stock guard
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 5, unitSellingPricePaise: 100 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 500 }],
      };

      await service.createSale('store_1', 'user_1', dto, 'req_1');

      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requiresReconciliation: true, quantityAfter: -4 }),
        }),
      );
    });

    it('returns the winning sale when a concurrent request wins the idempotency race', async () => {
      const winner = { id: 'sale_winner', items: [], payments: [], invoice: { id: 'inv_w' } };
      mockPrismaService.sale.findUnique
        .mockResolvedValueOnce(null) // pre-check: not found, so we proceed
        .mockResolvedValueOnce(winner); // after P2002: the concurrent winner exists
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
      mockPrismaService.$transaction.mockRejectedValueOnce(p2002);

      const dto = {
        idempotencyKey: 'idem_race',
        saleSource: SaleSource.ONLINE,
        items: [],
        payments: [],
      };

      const result = await service.createSale('store_1', 'user_1', dto, 'req_1');
      expect(result).toEqual(winner);
    });

    it('aggregates totals across multiple items and batches', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockImplementation(({ where: { id } }: any) =>
        Promise.resolve({ id, taxRateBps: 0, name: id }),
      );
      mockTx.inventoryBatch.findUnique.mockImplementation(({ where: { id } }: any) =>
        Promise.resolve({ id, currentQuantity: 100, purchasePricePaise: id === 'batch_A' ? 50n : 30n }),
      );
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_multi', invoice: { id: 'inv_m' }, items: [] });

      const dto = {
        idempotencyKey: 'idem_multi',
        saleSource: SaleSource.ONLINE,
        items: [
          { productId: 'prod_A', batchId: 'batch_A', quantity: 2, unitSellingPricePaise: 100 }, // gross 200, cost 100, profit 100
          { productId: 'prod_B', batchId: 'batch_B', quantity: 3, unitSellingPricePaise: 50 }, // gross 150, cost 90, profit 60
        ],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 350 }],
      };

      await service.createSale('store_1', 'user_1', dto, 'req_1');

      expect(mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalPaise: 350n,
            taxPaise: 0n,
            totalPaise: 350n,
            profitPaise: 160n,
            paymentStatus: 'PAID',
          }),
        }),
      );
    });

    it('applies a line discount to total and profit', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 10, purchasePricePaise: 50n });
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_disc', invoice: { id: 'inv_d' }, items: [] });

      const dto = {
        idempotencyKey: 'idem_disc',
        saleSource: SaleSource.ONLINE,
        // gross 200, discount 30, tax 0 -> total 170, cost 100 -> profit 70
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 2, unitSellingPricePaise: 100, discountPaise: 30 }],
        payments: [{ method: PaymentMethod.CASH, amountPaise: 170 }],
      };

      await service.createSale('store_1', 'user_1', dto, 'req_1');

      expect(mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalPaise: 200n,
            discountPaise: 30n,
            totalPaise: 170n,
            profitPaise: 70n,
          }),
        }),
      );
    });

    it('marks the sale PARTIALLY_PAID when payment is less than the total', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(null);
      mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
      mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 1000, name: 'Prod' });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 10, purchasePricePaise: 50n });
      mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
      mockTx.sale.create.mockResolvedValue({ id: 'sale_part', invoice: { id: 'inv_p' }, items: [] });

      const dto = {
        idempotencyKey: 'idem_part',
        saleSource: SaleSource.ONLINE,
        items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 2, unitSellingPricePaise: 100 }], // total 220
        payments: [{ method: PaymentMethod.CASH, amountPaise: 100 }], // partial
      };

      await service.createSale('store_1', 'user_1', dto, 'req_1');

      expect(mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'PARTIALLY_PAID' }) }),
      );
    });

    it('composes the invoice number from the Indian financial year', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-11T10:00:00Z'));
      try {
        mockPrismaService.sale.findUnique.mockResolvedValue(null);
        mockTx.store.findUnique.mockResolvedValue({ id: 'store_1', name: 'Store 1', allowNegativeStock: false });
        mockTx.product.findUnique.mockResolvedValue({ id: 'prod_1', taxRateBps: 0, name: 'Prod' });
        mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'batch_1', currentQuantity: 10, purchasePricePaise: 50n });
        mockTx.invoiceSequence.upsert.mockResolvedValue({ prefix: 'INV', nextNumber: 1 });
        mockTx.sale.create.mockResolvedValue({ id: 'sale_inv', invoice: { id: 'inv_i' }, items: [] });

        const dto = {
          idempotencyKey: 'idem_inv',
          saleSource: SaleSource.ONLINE,
          items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 1, unitSellingPricePaise: 100 }],
          payments: [{ method: PaymentMethod.CASH, amountPaise: 100 }],
        };

        await service.createSale('store_1', 'user_1', dto, 'req_1');

        expect(mockTx.sale.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              invoice: expect.objectContaining({
                create: expect.objectContaining({
                  financialYear: '2026-2027',
                  invoiceNumber: 'INV-2026-2027-00001',
                }),
              }),
            }),
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('syncSales', () => {
    const offlineDto = {
      idempotencyKey: 'idem_off_1',
      clientSaleId: 'local_1',
      deviceId: 'dev_1',
      saleSource: SaleSource.OFFLINE_SYNC,
      items: [{ productId: 'prod_1', batchId: 'batch_1', quantity: 5, unitSellingPricePaise: 100 }],
      payments: [{ method: PaymentMethod.CASH, amountPaise: 500 }],
    };

    it('syncs a sale and flags reconciliation when stock went negative', async () => {
      jest.spyOn(service, 'createSale').mockResolvedValue({ id: 'sale_1', invoice: { id: 'inv_1' } } as any);
      mockPrismaService.stockMovement.count.mockResolvedValue(1); // one movement needs review
      mockPrismaService.syncEvent.findFirst.mockResolvedValue(null);

      const result = await service.syncSales('store_1', 'user_1', [offlineDto], 'req_1');

      expect(result.failed).toHaveLength(0);
      expect(result.synced).toHaveLength(1);
      expect(result.synced[0]).toMatchObject({
        clientMutationId: 'local_1',
        saleId: 'sale_1',
        invoiceId: 'inv_1',
        status: 'SYNCED',
        requiresReconciliation: true,
      });
      expect(result.synced[0]!.warnings).toHaveLength(1);
      expect(result.synced[0]!.warnings[0]!.code).toBe('STOCK_RECONCILIATION_REQUIRED');
      expect(mockPrismaService.syncEvent.create).toHaveBeenCalled();
    });

    it('records a failed sale without throwing', async () => {
      jest.spyOn(service, 'createSale').mockRejectedValue(new Error('db down'));
      mockPrismaService.syncEvent.findFirst.mockResolvedValue(null);

      const result = await service.syncSales('store_1', 'user_1', [offlineDto], 'req_1');

      expect(result.synced).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({ clientMutationId: 'local_1', status: 'FAILED' });
      expect(result.failed[0]!.error.code).toBe('INTERNAL_ERROR');
    });

    it('updates the existing sync event on retry instead of duplicating it', async () => {
      jest.spyOn(service, 'createSale').mockResolvedValue({ id: 'sale_r', invoice: { id: 'inv_r' } } as any);
      mockPrismaService.stockMovement.count.mockResolvedValue(0);
      mockPrismaService.syncEvent.findFirst.mockResolvedValue({ id: 'se1', attemptCount: 2 }); // already tried twice

      const result = await service.syncSales('store_1', 'user_1', [offlineDto], 'req_1');

      expect(mockPrismaService.syncEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'se1' }, data: expect.objectContaining({ attemptCount: 3 }) }),
      );
      expect(mockPrismaService.syncEvent.create).not.toHaveBeenCalled();
      expect(result.synced[0]!.requiresReconciliation).toBe(false);
    });
  });
});

describe('getIndianFinancialYear', () => {
  it('maps April onwards to the current-year FY', () => {
    expect(getIndianFinancialYear(new Date('2026-04-01T00:00:00'))).toBe('2026-2027');
    expect(getIndianFinancialYear(new Date('2026-07-11T00:00:00'))).toBe('2026-2027');
    expect(getIndianFinancialYear(new Date('2026-12-31T00:00:00'))).toBe('2026-2027');
  });

  it('maps January–March to the previous-year FY', () => {
    expect(getIndianFinancialYear(new Date('2026-01-15T00:00:00'))).toBe('2025-2026');
    expect(getIndianFinancialYear(new Date('2026-03-31T00:00:00'))).toBe('2025-2026');
  });
});
