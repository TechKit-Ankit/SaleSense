import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '@salesense/db';

const mockPrismaService = {
  store: { findUnique: jest.fn() },
  sale: { aggregate: jest.fn(), findMany: jest.fn() },
  saleItem: { groupBy: jest.fn() },
  inventoryBatch: { findMany: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
  stockMovement: { count: jest.fn() },
  product: { findMany: jest.fn() },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('converts paise sums to rupees and returns order count', async () => {
      mockPrismaService.sale.aggregate.mockResolvedValue({
        _sum: { totalPaise: 123450n, profitPaise: 45600n },
        _count: { id: 7 },
      });

      const result = await service.getSummary('store_1');

      expect(result).toEqual({ revenue: 1234.5, profit: 456, totalOrders: 7 });
    });

    it('returns zeros when there are no sales', async () => {
      mockPrismaService.sale.aggregate.mockResolvedValue({
        _sum: { totalPaise: null, profitPaise: null },
        _count: { id: 0 },
      });

      const result = await service.getSummary('store_1');

      expect(result).toEqual({ revenue: 0, profit: 0, totalOrders: 0 });
    });
  });

  describe('getRevenueChart', () => {
    it('buckets sales by ISO day in the store timezone and sorts chronologically', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
      mockPrismaService.sale.findMany.mockResolvedValue([
        // 19:30 UTC on Jul 10 = 01:00 IST Jul 11 → must land on 2026-07-11
        { createdAt: new Date('2026-07-10T19:30:00Z'), totalPaise: 10000n, profitPaise: 2000n },
        // 09:00 UTC on Jul 10 = 14:30 IST Jul 10 → 2026-07-10
        { createdAt: new Date('2026-07-10T09:00:00Z'), totalPaise: 5000n, profitPaise: 1000n },
        // second sale on the same IST day aggregates into the same bucket
        { createdAt: new Date('2026-07-10T10:00:00Z'), totalPaise: 5000n, profitPaise: 1000n },
      ]);

      const result = await service.getRevenueChart('store_1');

      expect(result).toEqual([
        { date: '2026-07-10', revenue: 100, profit: 20 },
        { date: '2026-07-11', revenue: 100, profit: 20 },
      ]);
    });

    it('keeps the same calendar day of different years in separate buckets', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
      mockPrismaService.sale.findMany.mockResolvedValue([
        { createdAt: new Date('2025-07-11T09:00:00Z'), totalPaise: 1000n, profitPaise: 100n },
        { createdAt: new Date('2026-07-11T09:00:00Z'), totalPaise: 2000n, profitPaise: 200n },
      ]);

      const result = await service.getRevenueChart('store_1', '2025-01-01', '2026-12-31');

      expect(result.map((r) => r.date)).toEqual(['2025-07-11', '2026-07-11']);
    });
  });

  describe('getTopProducts', () => {
    it('maps grouped sale items with paise-to-rupee conversion', async () => {
      mockPrismaService.saleItem.groupBy.mockResolvedValue([
        {
          productId: 'prod_1',
          productNameSnapshot: 'Milk 500ml',
          _sum: { quantity: 12, lineTotalPaise: 36000n },
        },
      ]);

      const result = await service.getTopProducts('store_1');

      expect(result).toEqual([
        { productId: 'prod_1', productName: 'Milk 500ml', quantitySold: 12, revenue: 360 },
      ]);
    });
  });

  describe('getDeadStock', () => {
    it('excludes sold products and computes locked value at purchase cost', async () => {
      mockPrismaService.saleItem.groupBy.mockResolvedValue([{ productId: 'prod_sold' }]);
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        // two batches of the same dead product at different costs
        { productId: 'prod_dead', currentQuantity: 4, purchasePricePaise: 5000n },
        { productId: 'prod_dead', currentQuantity: 6, purchasePricePaise: 4000n },
      ]);
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod_dead', name: 'Winter Coat' },
      ]);

      const result = await service.getDeadStock('store_1');

      // locked value = 4*50 + 6*40 = 440 rupees (cost basis, not retail)
      expect(result).toEqual([
        { productId: 'prod_dead', productName: 'Winter Coat', stockQuantity: 10, lockedValue: 440 },
      ]);
      // the query must exclude products that did sell in the period
      expect(mockPrismaService.inventoryBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId: { notIn: ['prod_sold'] } }),
        }),
      );
    });
  });

  describe('getInventoryHealth', () => {
    it('returns low-stock, reconciliation, expired and expiring-soon counters', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
      mockPrismaService.inventoryBatch.groupBy.mockResolvedValue([
        { productId: 'p1', _sum: { currentQuantity: 3 } },
        { productId: 'p2', _sum: { currentQuantity: 8 } },
      ]);
      mockPrismaService.stockMovement.count.mockResolvedValue(2);
      mockPrismaService.inventoryBatch.count
        .mockResolvedValueOnce(1) // expired
        .mockResolvedValueOnce(4); // expiring soon

      const result = await service.getInventoryHealth('store_1');

      expect(result).toEqual({
        lowStockCount: 2,
        thresholdUsed: 10,
        reconciliationCount: 2,
        expiredCount: 1,
        expiringSoonCount: 4,
        expiryWindowDays: 30,
      });
      // reconciliation counter must query flagged movements only
      expect(mockPrismaService.stockMovement.count).toHaveBeenCalledWith({
        where: { storeId: 'store_1', requiresReconciliation: true },
      });
    });

    it('uses a 30-day window boundary for expiring-soon batches', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
      mockPrismaService.inventoryBatch.groupBy.mockResolvedValue([]);
      mockPrismaService.stockMovement.count.mockResolvedValue(0);
      mockPrismaService.inventoryBatch.count.mockResolvedValue(0);

      await service.getInventoryHealth('store_1');

      const expiringCall = mockPrismaService.inventoryBatch.count.mock.calls[1]![0];
      const { gte, lt } = expiringCall.where.expiryDate;
      const windowMs = lt.getTime() - gte.getTime();
      expect(windowMs).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });
});
