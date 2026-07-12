import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { subDays } from 'date-fns';
import { BusinessException } from '../../common/errors/business-exception.js';
import { PRODUCT_NOT_FOUND, ERROR_CODE_HTTP_STATUS } from '../../common/errors/error-codes.js';
import { SimulateDiscountDto, DiscountType } from './dto/simulate-discount.dto.js';
import { SimulateBogoDto } from './dto/simulate-bogo.dto.js';

/** Scenario table steps (volume uplift %) — fixed per design doc 0006. */
const SCENARIO_UPLIFTS = [0, 10, 25, 50, 100];
const DEFAULT_PERIOD_DAYS = 30;

export interface SimulationWarning {
  code: string;
  message: string;
}

interface Baseline {
  product: { id: string; name: string };
  sellingPricePaise: bigint; // S
  unitCostPaise: bigint; // C
  unitMarginPaise: bigint; // M0 = S - C
  periodDays: number;
  unitsSold: number; // V0
  baselineProfitPaise: bigint; // P0 = M0 * V0 (current-price normalized, ADR-0006 rules)
  warnings: SimulationWarning[];
}

/** ceil(a / b) for positive BigInts. */
function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/** Percentage of `part` over `whole`, rounded to 1 decimal (display ratio, not money). */
function pct(part: number, whole: number): number {
  return Math.round((part / whole) * 1000) / 10;
}

@Injectable()
export class SimulatorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the shared simulation baseline (design doc 0006, "Shared math"):
   * - unit cost = weighted average of ACTIVE batches with stock, falling back
   *   to the most recent sale's recorded cost, then 0 + NO_COST_DATA warning;
   * - baseline volume from sale_items in the lookback period;
   * - baseline profit normalized to CURRENT price (never historical profit).
   */
  private async getBaseline(storeId: string, productId: string, periodDays: number): Promise<Baseline> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.storeId !== storeId || product.status !== 'ACTIVE') {
      throw new BusinessException(
        PRODUCT_NOT_FOUND,
        'Product was not found.',
        ERROR_CODE_HTTP_STATUS[PRODUCT_NOT_FOUND] ?? 404,
      );
    }

    const warnings: SimulationWarning[] = [];
    const start = subDays(new Date(), periodDays);

    // Unit cost: weighted average over sellable stock.
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { storeId, productId, status: 'ACTIVE', currentQuantity: { gt: 0 } },
      select: { currentQuantity: true, purchasePricePaise: true },
    });

    let unitCostPaise = 0n;
    if (batches.length > 0) {
      let totalQty = 0n;
      let totalCost = 0n;
      for (const b of batches) {
        totalQty += BigInt(b.currentQuantity);
        totalCost += BigInt(b.currentQuantity) * b.purchasePricePaise;
      }
      unitCostPaise = totalCost / totalQty;
    } else {
      // Fallback: cost recorded on the most recent sale of this product.
      const lastSaleItem = await this.prisma.saleItem.findFirst({
        where: { storeId, productId },
        orderBy: { sale: { createdAt: 'desc' } },
        select: { unitPurchasePricePaise: true },
      });
      if (lastSaleItem) {
        unitCostPaise = lastSaleItem.unitPurchasePricePaise;
      } else {
        warnings.push({
          code: 'NO_COST_DATA',
          message: 'No batch or sales cost found — profit figures are revenue-only.',
        });
      }
    }

    // Baseline volume in the period.
    const volume = await this.prisma.saleItem.aggregate({
      where: {
        storeId,
        productId,
        sale: {
          status: { in: ['COMPLETED', 'PENDING_SYNC'] },
          createdAt: { gte: start },
        },
      },
      _sum: { quantity: true },
    });
    const unitsSold = volume._sum.quantity ?? 0;
    if (unitsSold === 0) {
      warnings.push({
        code: 'NO_SALES_HISTORY',
        message: `No sales in the last ${periodDays} days — break-even and scenarios are unavailable.`,
      });
    }

    const sellingPricePaise = product.sellingPricePaise;
    const unitMarginPaise = sellingPricePaise - unitCostPaise;

    return {
      product: { id: product.id, name: product.name },
      sellingPricePaise,
      unitCostPaise,
      unitMarginPaise,
      periodDays,
      unitsSold,
      baselineProfitPaise: unitMarginPaise * BigInt(unitsSold),
      warnings,
    };
  }

  private baselineJson(b: Baseline) {
    return {
      sellingPricePaise: Number(b.sellingPricePaise),
      unitCostPaise: Number(b.unitCostPaise),
      unitMarginPaise: Number(b.unitMarginPaise),
      periodDays: b.periodDays,
      unitsSold: b.unitsSold,
      baselineProfitPaise: Number(b.baselineProfitPaise),
    };
  }

  /** Profit at a given volume uplift, vs the normalized baseline. */
  private scenarioAt(marginPaise: bigint, baseline: Baseline, upliftPct: number) {
    const unitsSold = Math.round(baseline.unitsSold * (1 + upliftPct / 100));
    const profitPaise = marginPaise * BigInt(unitsSold);
    const p0 = baseline.baselineProfitPaise;
    return {
      upliftPct,
      unitsSold,
      profitPaise: Number(profitPaise),
      profitChangePct: p0 > 0n ? pct(Number(profitPaise) - Number(p0), Number(p0)) : null,
    };
  }

  async simulateDiscount(storeId: string, dto: SimulateDiscountDto) {
    const periodDays = dto.periodDays ?? DEFAULT_PERIOD_DAYS;
    const baseline = await this.getBaseline(storeId, dto.productId, periodDays);
    const warnings = [...baseline.warnings];

    const S = baseline.sellingPricePaise;

    let discountPaise: bigint;
    if (dto.discountType === DiscountType.PERCENTAGE) {
      discountPaise = (S * BigInt(dto.discountValueBps!)) / 10000n;
    } else {
      discountPaise = BigInt(dto.discountValuePaise!);
      if (discountPaise >= S) {
        throw new BadRequestException(
          'Flat discount must be below the selling price — use the BOGO simulator for giveaways.',
        );
      }
    }

    const discountedPricePaise = S - discountPaise;
    const newMarginPaise = discountedPricePaise - baseline.unitCostPaise; // M1
    const M0 = baseline.unitMarginPaise;

    if (newMarginPaise <= 0n) {
      warnings.push({
        code: 'NEVER_PROFITABLE',
        message: 'This discount sells below cost — no sales volume can recover the loss.',
      });
    }

    // Break-even and scenarios need both history and a positive new margin.
    let breakEven = null;
    let scenarios = null;
    let projection = null;

    if (baseline.unitsSold > 0) {
      scenarios = SCENARIO_UPLIFTS.map((u) => this.scenarioAt(newMarginPaise, baseline, u));

      if (newMarginPaise > 0n && baseline.baselineProfitPaise > 0n) {
        const unitsRequired = Number(ceilDiv(baseline.baselineProfitPaise, newMarginPaise));
        breakEven = {
          unitsRequired,
          upliftRequiredPct: pct(unitsRequired - baseline.unitsSold, baseline.unitsSold),
        };
      }

      if (dto.expectedUpliftBps !== undefined) {
        projection = this.scenarioAt(newMarginPaise, baseline, dto.expectedUpliftBps / 100);
      }
    }

    return {
      product: baseline.product,
      baseline: this.baselineJson(baseline),
      simulated: {
        discountedPricePaise: Number(discountedPricePaise),
        unitMarginPaise: Number(newMarginPaise),
        marginChangePct: M0 > 0n ? pct(Number(newMarginPaise) - Number(M0), Number(M0)) : null,
      },
      breakEven,
      scenarios,
      projection,
      warnings,
    };
  }

  async simulateBogo(storeId: string, dto: SimulateBogoDto) {
    const periodDays = dto.periodDays ?? DEFAULT_PERIOD_DAYS;
    const baseline = await this.getBaseline(storeId, dto.productId, periodDays);
    const warnings = [...baseline.warnings];

    const N = dto.buyQuantity;
    const M = dto.freeQuantity;
    const unitsPerBundle = N + M;

    const bundleRevenuePaise = BigInt(N) * baseline.sellingPricePaise;
    const bundleCostPaise = BigInt(unitsPerBundle) * baseline.unitCostPaise;
    const bundleProfitPaise = bundleRevenuePaise - bundleCostPaise;

    if (bundleProfitPaise <= 0n) {
      warnings.push({
        code: 'NEVER_PROFITABLE',
        message:
          'Each bundle loses money at current cost — usable only to clear stock that would otherwise be written off.',
      });
    }

    let breakEven = null;
    if (baseline.unitsSold > 0 && bundleProfitPaise > 0n && baseline.baselineProfitPaise > 0n) {
      const bundlesRequired = Number(ceilDiv(baseline.baselineProfitPaise, bundleProfitPaise));
      const unitsMoved = bundlesRequired * unitsPerBundle;
      breakEven = {
        bundlesRequired,
        unitsMoved,
        upliftRequiredPct: pct(unitsMoved - baseline.unitsSold, baseline.unitsSold),
      };
    }

    return {
      product: baseline.product,
      baseline: this.baselineJson(baseline),
      bundle: {
        buyQuantity: N,
        freeQuantity: M,
        bundleRevenuePaise: Number(bundleRevenuePaise),
        bundleCostPaise: Number(bundleCostPaise),
        bundleProfitPaise: Number(bundleProfitPaise),
        effectiveDiscountPct: pct(M, unitsPerBundle),
        marginPerUnitMovedPaise: Number(bundleProfitPaise / BigInt(unitsPerBundle)),
      },
      breakEven,
      hadRecentSales: baseline.unitsSold > 0,
      warnings,
    };
  }
}
