import { Test, TestingModule } from '@nestjs/testing';
import { SimulatorsService } from './simulators.service';
import { PrismaService } from '@salesense/db';
import { BadRequestException } from '@nestjs/common';
import { DiscountType } from './dto/simulate-discount.dto';

const mockPrismaService = {
  product: { findUnique: jest.fn() },
  inventoryBatch: { findMany: jest.fn() },
  saleItem: { findFirst: jest.fn(), aggregate: jest.fn() },
};

// The worked example from design doc 0006 / its review:
// S = ₹120 (12000p); batches 30 @ ₹80 + 70 @ ₹95 → weighted C = ₹90.50 (9050p);
// 40 units sold in the last 30 days → M0 = 2950p, P0 = 118000p.
const shampoo = { id: 'prod_1', storeId: 'store_1', status: 'ACTIVE', name: 'Sunsilk Shampoo 180ml', sellingPricePaise: 12000n };
const shampooBatches = [
  { currentQuantity: 30, purchasePricePaise: 8000n },
  { currentQuantity: 70, purchasePricePaise: 9500n },
];

describe('SimulatorsService', () => {
  let service: SimulatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulatorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SimulatorsService>(SimulatorsService);
    jest.clearAllMocks();
  });

  const primeBaseline = (unitsSold = 40, batches: any[] = shampooBatches) => {
    mockPrismaService.product.findUnique.mockResolvedValue(shampoo);
    mockPrismaService.inventoryBatch.findMany.mockResolvedValue(batches);
    mockPrismaService.saleItem.aggregate.mockResolvedValue({ _sum: { quantity: unitsSold } });
  };

  describe('simulateDiscount', () => {
    it('computes weighted-average cost, break-even uplift and scenarios (10% discount)', async () => {
      primeBaseline();

      const result = await service.simulateDiscount('store_1', {
        productId: 'prod_1',
        discountType: DiscountType.PERCENTAGE,
        discountValueBps: 1000,
      } as any);

      expect(result.baseline).toEqual({
        sellingPricePaise: 12000,
        unitCostPaise: 9050, // weighted avg, NOT latest batch (9500)
        unitMarginPaise: 2950,
        periodDays: 30,
        unitsSold: 40,
        baselineProfitPaise: 118000,
      });
      expect(result.simulated).toEqual({
        discountedPricePaise: 10800,
        unitMarginPaise: 1750,
        marginChangePct: -40.7,
      });
      // ceil(118000 / 1750) = 68 units → +70% volume needed
      expect(result.breakEven).toEqual({ unitsRequired: 68, upliftRequiredPct: 70 });
      // +25% scenario: 50 units × 1750 = 87500 → −25.8% vs 118000
      const s25 = result.scenarios!.find((s: any) => s.upliftPct === 25);
      expect(s25).toEqual({ upliftPct: 25, unitsSold: 50, profitPaise: 87500, profitChangePct: -25.8 });
      expect(result.warnings).toHaveLength(0);
    });

    it('warns NEVER_PROFITABLE when the discount sells below cost, breakEven null', async () => {
      primeBaseline();

      const result = await service.simulateDiscount('store_1', {
        productId: 'prod_1',
        discountType: DiscountType.PERCENTAGE,
        discountValueBps: 3000, // 30% → price 8400 < cost 9050
      } as any);

      expect(result.simulated.unitMarginPaise).toBe(-650);
      expect(result.warnings.map((w: any) => w.code)).toContain('NEVER_PROFITABLE');
      expect(result.breakEven).toBeNull();
      // scenarios still returned so the owner sees the loss magnitude
      expect(result.scenarios).not.toBeNull();
    });

    it('rejects a flat discount at or above the selling price', async () => {
      primeBaseline();

      await expect(
        service.simulateDiscount('store_1', {
          productId: 'prod_1',
          discountType: DiscountType.FLAT,
          discountValuePaise: 12000,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns NO_SALES_HISTORY with null break-even and scenarios when V0 = 0', async () => {
      primeBaseline(0);

      const result = await service.simulateDiscount('store_1', {
        productId: 'prod_1',
        discountType: DiscountType.PERCENTAGE,
        discountValueBps: 1000,
      } as any);

      expect(result.warnings.map((w: any) => w.code)).toContain('NO_SALES_HISTORY');
      expect(result.breakEven).toBeNull();
      expect(result.scenarios).toBeNull();
    });

    it('falls back to the last sale cost when no batches, and warns NO_COST_DATA when neither exists', async () => {
      // Fallback 1: last sale item cost
      primeBaseline(40, []);
      mockPrismaService.saleItem.findFirst.mockResolvedValue({ unitPurchasePricePaise: 9000n });

      let result = await service.simulateDiscount('store_1', {
        productId: 'prod_1',
        discountType: DiscountType.PERCENTAGE,
        discountValueBps: 1000,
      } as any);
      expect(result.baseline.unitCostPaise).toBe(9000);
      expect(result.warnings).toHaveLength(0);

      // Fallback 2: no cost anywhere
      primeBaseline(40, []);
      mockPrismaService.saleItem.findFirst.mockResolvedValue(null);

      result = await service.simulateDiscount('store_1', {
        productId: 'prod_1',
        discountType: DiscountType.PERCENTAGE,
        discountValueBps: 1000,
      } as any);
      expect(result.baseline.unitCostPaise).toBe(0);
      expect(result.warnings.map((w: any) => w.code)).toContain('NO_COST_DATA');
    });

    it('adds a projection when the owner supplies an expected uplift', async () => {
      primeBaseline();

      const result = await service.simulateDiscount('store_1', {
        productId: 'prod_1',
        discountType: DiscountType.PERCENTAGE,
        discountValueBps: 1000,
        expectedUpliftBps: 2500, // +25%
      } as any);

      expect(result.projection).toEqual({ upliftPct: 25, unitsSold: 50, profitPaise: 87500, profitChangePct: -25.8 });
    });

    it('throws PRODUCT_NOT_FOUND for a foreign store product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({ ...shampoo, storeId: 'store_2' });

      await expect(
        service.simulateDiscount('store_1', {
          productId: 'prod_1',
          discountType: DiscountType.PERCENTAGE,
          discountValueBps: 1000,
        } as any),
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });
  });

  describe('simulateBogo', () => {
    it('flags a loss-making 2+1 bundle as NEVER_PROFITABLE with full economics', async () => {
      primeBaseline();

      const result = await service.simulateBogo('store_1', {
        productId: 'prod_1',
        buyQuantity: 2,
        freeQuantity: 1,
      } as any);

      // revenue 2×12000 = 24000; cost 3×9050 = 27150 → −3150 per bundle
      expect(result.bundle).toEqual({
        buyQuantity: 2,
        freeQuantity: 1,
        bundleRevenuePaise: 24000,
        bundleCostPaise: 27150,
        bundleProfitPaise: -3150,
        effectiveDiscountPct: 33.3,
        marginPerUnitMovedPaise: -1050,
      });
      expect(result.warnings.map((w: any) => w.code)).toContain('NEVER_PROFITABLE');
      expect(result.breakEven).toBeNull();
      expect(result.hadRecentSales).toBe(true);
    });

    it('computes break-even bundles for a profitable BOGO', async () => {
      // Cheap stock: 100 units at ₹60 → C = 6000p, M0 = 6000p, P0 = 240000p
      primeBaseline(40, [{ currentQuantity: 100, purchasePricePaise: 6000n }]);

      const result = await service.simulateBogo('store_1', {
        productId: 'prod_1',
        buyQuantity: 2,
        freeQuantity: 1,
      } as any);

      // bundle profit = 24000 − 18000 = 6000 → ceil(240000/6000) = 40 bundles = 120 units (+200%)
      expect(result.bundle.bundleProfitPaise).toBe(6000);
      expect(result.breakEven).toEqual({ bundlesRequired: 40, unitsMoved: 120, upliftRequiredPct: 200 });
      expect(result.warnings).toHaveLength(0);
    });

    it('sets hadRecentSales=false for dead-stock products', async () => {
      primeBaseline(0);

      const result = await service.simulateBogo('store_1', {
        productId: 'prod_1',
        buyQuantity: 2,
        freeQuantity: 1,
      } as any);

      expect(result.hadRecentSales).toBe(false);
      expect(result.warnings.map((w: any) => w.code)).toContain('NO_SALES_HISTORY');
    });
  });
});
