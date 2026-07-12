import { Injectable } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { subDays } from 'date-fns';

/** Thresholds shared with analytics/design-0005 — one mental model. */
const LOW_STOCK_THRESHOLD = 10;
const EXPIRY_WINDOW_DAYS = 30;
const TOP_SELLERS_COUNT = 10;
const MAX_PER_RULE = 5;
const MAX_OVERALL = 20;
const DEFAULT_PERIOD_DAYS = 30;

export type RecommendationSeverity = 'HIGH' | 'MEDIUM' | 'INFO';

export interface Recommendation {
  code: string;
  severity: RecommendationSeverity;
  title: string;
  detail: string;
  productId?: string;
  metrics: Record<string, number | string | null>;
  action: { label: string; href: string };
}

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  INFO: 2,
};

/** Rupee string for prose only — structured metrics stay integer paise. */
function rupees(paise: bigint | number): string {
  return `₹${Math.round(Number(paise) / 100).toLocaleString('en-IN')}`;
}

@Injectable()
export class AdvisorService {
  constructor(private readonly prisma: PrismaService) {}

  /** Store-local "today" boundary, consistent with ADR-0005 rule 1. */
  private async getTodayBoundary(storeId: string): Promise<{ today: Date; windowEnd: Date }> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true },
    });
    const todayIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: store?.timezone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const today = new Date(todayIso);
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + EXPIRY_WINDOW_DAYS);
    return { today, windowEnd };
  }

  async getRecommendations(storeId: string, periodDays = DEFAULT_PERIOD_DAYS) {
    const start = subDays(new Date(), periodDays);
    const { today, windowEnd } = await this.getTodayBoundary(storeId);

    const ruleResults = await Promise.all([
      this.ruleLowStockBestseller(storeId, start, periodDays),
      this.ruleNegativeMargin(storeId),
      this.ruleExpiredOnShelf(storeId, today),
      this.ruleExpiringSoon(storeId, today, windowEnd),
      this.ruleDeadStock(storeId, start, periodDays),
      this.ruleReconciliationPending(storeId),
    ]);

    const recommendations = ruleResults
      .flatMap((r) => r.slice(0, MAX_PER_RULE))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, MAX_OVERALL);

    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      recommendations,
    };
  }

  /** HIGH: a top-10 seller whose total active stock is under the threshold. */
  private async ruleLowStockBestseller(storeId: string, start: Date, periodDays: number): Promise<Recommendation[]> {
    const topSellers = await this.prisma.saleItem.groupBy({
      by: ['productId', 'productNameSnapshot'],
      where: {
        storeId,
        sale: { status: { in: ['COMPLETED', 'PENDING_SYNC'] }, createdAt: { gte: start } },
      },
      _sum: { quantity: true, lineTotalPaise: true },
      orderBy: { _sum: { lineTotalPaise: 'desc' } },
      take: TOP_SELLERS_COUNT,
    });
    if (topSellers.length === 0) return [];

    const stockGroups = await this.prisma.inventoryBatch.groupBy({
      by: ['productId'],
      where: {
        storeId,
        status: 'ACTIVE',
        productId: { in: topSellers.map((t) => t.productId) },
      },
      _sum: { currentQuantity: true },
    });
    const stockByProduct = new Map(stockGroups.map((g) => [g.productId, g._sum.currentQuantity ?? 0]));

    const recs: Recommendation[] = [];
    topSellers.forEach((seller, index) => {
      const currentStock = stockByProduct.get(seller.productId) ?? 0;
      if (currentStock >= LOW_STOCK_THRESHOLD) return;

      const unitsSold = seller._sum.quantity ?? 0;
      const dailyRate = unitsSold / periodDays;
      const coverDays = dailyRate > 0 ? Math.floor(currentStock / dailyRate) : null;

      recs.push({
        code: 'LOW_STOCK_BESTSELLER',
        severity: 'HIGH',
        title: `Reorder ${seller.productNameSnapshot} — #${index + 1} seller, only ${currentStock} left`,
        detail: `Sold ${unitsSold} units in the last ${periodDays} days${
          coverDays !== null ? `; current stock covers ~${coverDays} day(s)` : ''
        }. A stock-out on a bestseller loses guaranteed revenue.`,
        productId: seller.productId,
        metrics: {
          unitsSold,
          currentStock,
          revenuePaise: Number(seller._sum.lineTotalPaise ?? 0n),
          rank: index + 1,
        },
        action: { label: 'View purchases', href: '/purchases' },
      });
    });
    return recs;
  }

  /** HIGH: current selling price below the weighted-average batch cost (design-0006 cost basis). */
  private async ruleNegativeMargin(storeId: string): Promise<Recommendation[]> {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { storeId, status: 'ACTIVE', currentQuantity: { gt: 0 } },
      select: {
        productId: true,
        currentQuantity: true,
        purchasePricePaise: true,
        product: { select: { id: true, name: true, sellingPricePaise: true, status: true } },
      },
    });

    const perProduct = new Map<
      string,
      { name: string; sellingPricePaise: bigint; qty: bigint; cost: bigint }
    >();
    for (const b of batches) {
      if (b.product.status !== 'ACTIVE') continue;
      const entry =
        perProduct.get(b.productId) ??
        { name: b.product.name, sellingPricePaise: b.product.sellingPricePaise, qty: 0n, cost: 0n };
      entry.qty += BigInt(b.currentQuantity);
      entry.cost += BigInt(b.currentQuantity) * b.purchasePricePaise;
      perProduct.set(b.productId, entry);
    }

    const recs: Recommendation[] = [];
    for (const [productId, p] of perProduct) {
      const unitCost = p.cost / p.qty;
      if (p.sellingPricePaise >= unitCost) continue;
      const lossPerUnit = unitCost - p.sellingPricePaise;
      recs.push({
        code: 'NEGATIVE_MARGIN',
        severity: 'HIGH',
        title: `${p.name} sells below cost — losing ${rupees(lossPerUnit)} per unit`,
        detail: `Selling price ${rupees(p.sellingPricePaise)} vs weighted stock cost ${rupees(unitCost)}. Every sale loses money — reprice or verify the purchase cost.`,
        productId,
        metrics: {
          sellingPricePaise: Number(p.sellingPricePaise),
          unitCostPaise: Number(unitCost),
          lossPerUnitPaise: Number(lossPerUnit),
        },
        action: { label: 'Edit product', href: '/catalog/products' },
      });
    }
    // Worst losses first so the per-rule cap keeps the most urgent.
    return recs.sort((a, b) => Number(b.metrics.lossPerUnitPaise) - Number(a.metrics.lossPerUnitPaise));
  }

  private async expiryRecs(
    storeId: string,
    expiryDate: object,
    build: (agg: { productId: string; name: string; units: number; costPaise: bigint }) => Recommendation,
  ): Promise<Recommendation[]> {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { storeId, status: 'ACTIVE', currentQuantity: { gt: 0 }, expiryDate },
      select: {
        productId: true,
        currentQuantity: true,
        purchasePricePaise: true,
        product: { select: { name: true } },
      },
    });

    const perProduct = new Map<string, { name: string; units: number; costPaise: bigint }>();
    for (const b of batches) {
      const entry = perProduct.get(b.productId) ?? { name: b.product.name, units: 0, costPaise: 0n };
      entry.units += b.currentQuantity;
      entry.costPaise += BigInt(b.currentQuantity) * b.purchasePricePaise;
      perProduct.set(b.productId, entry);
    }

    return [...perProduct.entries()]
      .map(([productId, agg]) => build({ productId, ...agg }))
      .sort((a, b) => Number(b.metrics.costValuePaise) - Number(a.metrics.costValuePaise));
  }

  /** HIGH: expired batches still on the shelf. */
  private ruleExpiredOnShelf(storeId: string, today: Date): Promise<Recommendation[]> {
    return this.expiryRecs(storeId, { lt: today }, (agg) => ({
      code: 'EXPIRED_ON_SHELF',
      severity: 'HIGH',
      title: `${agg.name}: ${agg.units} expired unit(s) on the shelf`,
      detail: `Pull them from the shelf and write off ${rupees(agg.costPaise)} (cost) via a stock adjustment so inventory stays honest.`,
      productId: agg.productId,
      metrics: { units: agg.units, costValuePaise: Number(agg.costPaise) },
      action: { label: 'Open inventory', href: '/inventory' },
    }));
  }

  /** MEDIUM: batches expiring within the window. */
  private ruleExpiringSoon(storeId: string, today: Date, windowEnd: Date): Promise<Recommendation[]> {
    return this.expiryRecs(storeId, { gte: today, lt: windowEnd }, (agg) => ({
      code: 'EXPIRING_SOON',
      severity: 'MEDIUM',
      title: `${agg.name}: ${agg.units} unit(s) expire within ${EXPIRY_WINDOW_DAYS} days`,
      detail: `${rupees(agg.costPaise)} of cost is at risk. Simulate a discount now — selling at a thinner margin beats a full write-off.`,
      productId: agg.productId,
      metrics: { units: agg.units, costValuePaise: Number(agg.costPaise), windowDays: EXPIRY_WINDOW_DAYS },
      action: { label: 'Simulate an offer', href: '/promotions' },
    }));
  }

  /** MEDIUM: stock on hand with zero sales in the period (analytics dead-stock definition). */
  private async ruleDeadStock(storeId: string, start: Date, periodDays: number): Promise<Recommendation[]> {
    const sold = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        storeId,
        sale: { status: { in: ['COMPLETED', 'PENDING_SYNC'] }, createdAt: { gte: start } },
      },
    });

    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
        currentQuantity: { gt: 0 },
        productId: { notIn: sold.map((s) => s.productId) },
      },
      select: {
        productId: true,
        currentQuantity: true,
        purchasePricePaise: true,
        product: { select: { name: true } },
      },
    });

    const perProduct = new Map<string, { name: string; units: number; lockedPaise: bigint }>();
    for (const b of batches) {
      const entry = perProduct.get(b.productId) ?? { name: b.product.name, units: 0, lockedPaise: 0n };
      entry.units += b.currentQuantity;
      entry.lockedPaise += BigInt(b.currentQuantity) * b.purchasePricePaise;
      perProduct.set(b.productId, entry);
    }

    return [...perProduct.entries()]
      .map(([productId, agg]): Recommendation => ({
        code: 'DEAD_STOCK',
        severity: 'MEDIUM',
        title: `${agg.name}: no sales in ${periodDays} days, ${rupees(agg.lockedPaise)} locked`,
        detail: `${agg.units} unit(s) sit on the shelf tying up capital. A BOGO or discount can turn them back into cash — simulate it first.`,
        productId,
        metrics: { units: agg.units, lockedValuePaise: Number(agg.lockedPaise), periodDays },
        action: { label: 'Simulate an offer', href: '/promotions' },
      }))
      .sort((a, b) => Number(b.metrics.lockedValuePaise) - Number(a.metrics.lockedValuePaise));
  }

  /** INFO: flagged stock movements awaiting reconciliation. */
  private async ruleReconciliationPending(storeId: string): Promise<Recommendation[]> {
    const count = await this.prisma.stockMovement.count({
      where: { storeId, requiresReconciliation: true },
    });
    if (count === 0) return [];
    return [
      {
        code: 'RECONCILIATION_PENDING',
        severity: 'INFO',
        title: `${count} stock item(s) awaiting reconciliation`,
        detail: 'Offline sales oversold recorded stock. Do a physical count and resolve each item so inventory numbers stay trustworthy.',
        metrics: { count },
        action: { label: 'Reconcile now', href: '/inventory/reconciliation' },
      },
    ];
  }
}
