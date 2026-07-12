import { Test, TestingModule } from '@nestjs/testing';
import { AdvisorService } from './advisor.service';
import { PrismaService } from '@salesense/db';

const mockPrismaService = {
  store: { findUnique: jest.fn() },
  saleItem: { groupBy: jest.fn() },
  inventoryBatch: { groupBy: jest.fn(), findMany: jest.fn() },
  stockMovement: { count: jest.fn() },
};

/**
 * The service issues several inventoryBatch.findMany calls with distinct
 * `where` shapes; tests dispatch on those shapes to prime each rule.
 */
type BatchDatasets = {
  negativeMargin?: any[]; // no expiryDate filter, no notIn
  expired?: any[]; // expiryDate.lt only
  expiring?: any[]; // expiryDate.gte + lt
  dead?: any[]; // productId.notIn
};

const primeBatchFindMany = (data: BatchDatasets) => {
  mockPrismaService.inventoryBatch.findMany.mockImplementation(({ where }: any) => {
    if (where.expiryDate?.gte) return Promise.resolve(data.expiring ?? []);
    if (where.expiryDate?.lt) return Promise.resolve(data.expired ?? []);
    if (where.productId?.notIn) return Promise.resolve(data.dead ?? []);
    return Promise.resolve(data.negativeMargin ?? []);
  });
};

/** saleItem.groupBy: the top-sellers call has orderBy; the dead-stock sold-ids call does not. */
const primeSaleGroupBy = (topSellers: any[], soldIds: any[]) => {
  mockPrismaService.saleItem.groupBy.mockImplementation((args: any) =>
    Promise.resolve(args.orderBy ? topSellers : soldIds),
  );
};

describe('AdvisorService', () => {
  let service: AdvisorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvisorService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdvisorService>(AdvisorService);
    jest.clearAllMocks();

    // Healthy-store defaults; each test primes only what its rule needs.
    mockPrismaService.store.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
    primeSaleGroupBy([], []);
    mockPrismaService.inventoryBatch.groupBy.mockResolvedValue([]);
    primeBatchFindMany({});
    mockPrismaService.stockMovement.count.mockResolvedValue(0);
  });

  it('returns an empty list for a healthy store', async () => {
    const result = await service.getRecommendations('store_1');
    expect(result.recommendations).toEqual([]);
    expect(result.periodDays).toBe(30);
  });

  it('flags a low-stock bestseller but not a well-stocked one', async () => {
    primeSaleGroupBy(
      [
        { productId: 'p_hot', productNameSnapshot: 'Milk', _sum: { quantity: 120, lineTotalPaise: 360000n } },
        { productId: 'p_ok', productNameSnapshot: 'Rice', _sum: { quantity: 50, lineTotalPaise: 250000n } },
      ],
      [{ productId: 'p_hot' }, { productId: 'p_ok' }], // both sold → no dead stock
    );
    mockPrismaService.inventoryBatch.groupBy.mockResolvedValue([
      { productId: 'p_hot', _sum: { currentQuantity: 4 } }, // low
      { productId: 'p_ok', _sum: { currentQuantity: 80 } }, // fine
    ]);

    const result = await service.getRecommendations('store_1');

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      code: 'LOW_STOCK_BESTSELLER',
      severity: 'HIGH',
      productId: 'p_hot',
      metrics: { unitsSold: 120, currentStock: 4, revenuePaise: 360000, rank: 1 },
      action: { href: '/purchases' },
    });
    // 120 units / 30 days = 4/day → 4 units cover ~1 day
    expect(result.recommendations[0]!.detail).toContain('~1 day');
  });

  it('flags selling below weighted-average cost', async () => {
    primeBatchFindMany({
      negativeMargin: [
        // weighted cost: (10×100 + 30×140)/40 = 130 > price 120
        { productId: 'p1', currentQuantity: 10, purchasePricePaise: 10000n, product: { id: 'p1', name: 'Oil 1L', sellingPricePaise: 12000n, status: 'ACTIVE' } },
        { productId: 'p1', currentQuantity: 30, purchasePricePaise: 14000n, product: { id: 'p1', name: 'Oil 1L', sellingPricePaise: 12000n, status: 'ACTIVE' } },
      ],
    });

    const result = await service.getRecommendations('store_1');

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      code: 'NEGATIVE_MARGIN',
      severity: 'HIGH',
      productId: 'p1',
      metrics: { sellingPricePaise: 12000, unitCostPaise: 13000, lossPerUnitPaise: 1000 },
    });
  });

  it('separates expired stock from expiring-soon stock with cost values', async () => {
    primeBatchFindMany({
      expired: [
        { productId: 'p_old', currentQuantity: 10, purchasePricePaise: 2000n, product: { name: 'Bread' } },
      ],
      expiring: [
        { productId: 'p_soon', currentQuantity: 20, purchasePricePaise: 5000n, product: { name: 'Curd' } },
      ],
    });

    const result = await service.getRecommendations('store_1');
    const codes = result.recommendations.map((r) => r.code);

    expect(codes).toEqual(['EXPIRED_ON_SHELF', 'EXPIRING_SOON']); // HIGH before MEDIUM
    expect(result.recommendations[0]!.metrics.costValuePaise).toBe(20000); // 10 × 2000
    expect(result.recommendations[1]!.metrics.costValuePaise).toBe(100000); // 20 × 5000
    expect(result.recommendations[1]!.action.href).toBe('/promotions');
  });

  it('flags dead stock with cost-basis locked value', async () => {
    primeSaleGroupBy([], [{ productId: 'p_sold' }]);
    primeBatchFindMany({
      dead: [
        { productId: 'p_dead', currentQuantity: 8, purchasePricePaise: 30000n, product: { name: 'Winter Coat' } },
      ],
    });

    const result = await service.getRecommendations('store_1');

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      code: 'DEAD_STOCK',
      severity: 'MEDIUM',
      productId: 'p_dead',
      metrics: { units: 8, lockedValuePaise: 240000 },
      action: { href: '/promotions' },
    });
  });

  it('reports pending reconciliation only when flagged movements exist', async () => {
    mockPrismaService.stockMovement.count.mockResolvedValue(3);

    const result = await service.getRecommendations('store_1');

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      code: 'RECONCILIATION_PENDING',
      severity: 'INFO',
      metrics: { count: 3 },
      action: { href: '/inventory/reconciliation' },
    });
  });

  it('orders results HIGH → MEDIUM → INFO across rules', async () => {
    // INFO + MEDIUM + HIGH all fire; assert final ordering.
    mockPrismaService.stockMovement.count.mockResolvedValue(1);
    primeSaleGroupBy([], [{ productId: 'p_sold' }]);
    primeBatchFindMany({
      negativeMargin: [
        { productId: 'p1', currentQuantity: 5, purchasePricePaise: 10000n, product: { id: 'p1', name: 'Oil', sellingPricePaise: 9000n, status: 'ACTIVE' } },
      ],
      dead: [
        { productId: 'p_dead', currentQuantity: 2, purchasePricePaise: 1000n, product: { name: 'Coat' } },
      ],
    });

    const result = await service.getRecommendations('store_1');

    expect(result.recommendations.map((r) => r.severity)).toEqual(['HIGH', 'MEDIUM', 'INFO']);
  });
});
