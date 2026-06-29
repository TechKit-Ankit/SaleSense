import { Injectable } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const dailyData: Record<string, { revenue: number; profit: number }> = {};
    
    sales.forEach((sale) => {
      const dateKey = format(sale.createdAt, 'MMM dd');
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { revenue: 0, profit: 0 };
      }
      dailyData[dateKey].revenue += Number(sale.totalPaise) / 100;
      dailyData[dateKey].profit += Number(sale.profitPaise) / 100;
    });

    return Object.keys(dailyData).map((date) => ({
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

    // 2. Get active inventory for products NOT in soldItems, ordered by stock volume
    const deadBatches = await this.prisma.inventoryBatch.groupBy({
      by: ['productId'],
      where: {
        storeId,
        status: 'ACTIVE',
        productId: { notIn: soldProductIds },
      },
      _sum: {
        currentQuantity: true,
      },
      orderBy: {
        _sum: {
          currentQuantity: 'desc',
        },
      },
      take: 10,
    });

    // 3. Resolve product names
    const deadProductIds = deadBatches.map(b => b.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: deadProductIds } },
      select: { id: true, name: true, sellingPricePaise: true },
    });

    return deadBatches.map(batch => {
      const product = products.find(p => p.id === batch.productId);
      return {
        productId: batch.productId,
        productName: product?.name || 'Unknown',
        stockQuantity: batch._sum.currentQuantity || 0,
        lockedValue: (batch._sum.currentQuantity || 0) * (Number(product?.sellingPricePaise ?? 0) / 100),
      };
    });
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
