import { Injectable } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { subDays } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the store's IANA timezone for business-day grouping.
   * Reports must bucket sales by the shop's local day, not the server's —
   * a 11:30 PM IST sale belongs to that IST date even on a UTC server.
   */
  private async getStoreTimezone(storeId: string): Promise<string> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true },
    });
    return store?.timezone || 'Asia/Kolkata';
  }

  async getSummary(storeId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await this.prisma.sale.aggregate({
      where: {
        storeId,
        status: { in: ['COMPLETED', 'PENDING_SYNC'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: {
        totalPaise: true,
        profitPaise: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      revenue: Number(result._sum.totalPaise || 0) / 100,
      profit: Number(result._sum.profitPaise || 0) / 100,
      totalOrders: result._count.id,
    };
  }

  async getRevenueChart(storeId: string, startDate?: string, endDate?: string, productId?: string) {
    const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate) : new Date();

    // To group by day, we fetch the records and group in memory for simplicity in MVP.
    const sales = await this.prisma.sale.findMany({
      where: {
        storeId,
        status: { in: ['COMPLETED', 'PENDING_SYNC'] },
        createdAt: { gte: start, lte: end },
        ...(productId ? { items: { some: { productId } } } : {}),
      },
      select: {
        createdAt: true,
        totalPaise: true,
        profitPaise: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // ISO keys (yyyy-mm-dd) in the store's timezone: unambiguous across years
    // and lexicographically sortable. 'en-CA' formats as YYYY-MM-DD natively.
    const timeZone = await this.getStoreTimezone(storeId);
    const dayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const dailyData: Record<string, { revenue: number; profit: number }> = {};

    sales.forEach((sale) => {
      const dateKey = dayFormatter.format(sale.createdAt);
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { revenue: 0, profit: 0 };
      }
      dailyData[dateKey].revenue += Number(sale.totalPaise) / 100;
      dailyData[dateKey].profit += Number(sale.profitPaise) / 100;
    });

    return Object.keys(dailyData)
      .sort()
      .map((date) => ({
        date,
        revenue: dailyData[date]!.revenue,
        profit: dailyData[date]!.profit,
      }));
  }

  async getTopProducts(storeId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate) : new Date();

    const items = await this.prisma.saleItem.groupBy({
      by: ['productId', 'productNameSnapshot'],
      where: {
        storeId,
        sale: {
          status: { in: ['COMPLETED', 'PENDING_SYNC'] },
          createdAt: { gte: start, lte: end },
        },
      },
      _sum: {
        quantity: true,
        lineTotalPaise: true,
      },
      orderBy: {
        _sum: {
          lineTotalPaise: 'desc',
        },
      },
      take: 10,
    });

    return items.map((item) => ({
      productId: item.productId,
      productName: item.productNameSnapshot,
      quantitySold: item._sum.quantity || 0,
      revenue: Number(item._sum.lineTotalPaise || 0) / 100,
    }));
  }

  async getDeadStock(storeId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Get products that HAVE been sold in this period
    const soldItems = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        storeId,
        sale: {
          status: { in: ['COMPLETED', 'PENDING_SYNC'] },
          createdAt: { gte: start, lte: end },
        },
      },
    });

    const soldProductIds = soldItems.map((i) => i.productId);

    // 2. Get active inventory for products NOT in soldItems. Fetch per-batch
    // rows so locked value can be computed at PURCHASE COST (what capital is
    // actually tied up), not at hoped-for retail value (see ADR-0005).
    const deadBatchRows = await this.prisma.inventoryBatch.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
        currentQuantity: { gt: 0 },
        productId: { notIn: soldProductIds },
      },
      select: {
        productId: true,
        currentQuantity: true,
        purchasePricePaise: true,
      },
    });

    // Aggregate per product: total quantity + cost-basis locked value.
    const perProduct = new Map<string, { stockQuantity: number; lockedValuePaise: bigint }>();
    for (const row of deadBatchRows) {
      const entry = perProduct.get(row.productId) ?? { stockQuantity: 0, lockedValuePaise: 0n };
      entry.stockQuantity += row.currentQuantity;
      entry.lockedValuePaise += BigInt(row.currentQuantity) * row.purchasePricePaise;
      perProduct.set(row.productId, entry);
    }

    const top = [...perProduct.entries()]
      .sort((a, b) => b[1].stockQuantity - a[1].stockQuantity)
      .slice(0, 10);

    // 3. Resolve product names
    const products = await this.prisma.product.findMany({
      where: { id: { in: top.map(([productId]) => productId) } },
      select: { id: true, name: true },
    });

    return top.map(([productId, agg]) => ({
      productId,
      productName: products.find((p) => p.id === productId)?.name || 'Unknown',
      stockQuantity: agg.stockQuantity,
      lockedValue: Number(agg.lockedValuePaise) / 100,
    }));
  }

  async getInventoryHealth(storeId: string) {
    const lowStockThreshold = 10;
    
    const batches = await this.prisma.inventoryBatch.groupBy({
      by: ['productId'],
      where: {
        storeId,
        status: 'ACTIVE',
      },
      _sum: {
        currentQuantity: true,
      },
      having: {
        currentQuantity: {
          _sum: {
            lt: lowStockThreshold,
          }
        }
      }
    });

    return {
      lowStockCount: batches.length,
      thresholdUsed: lowStockThreshold,
    };
  }
}
