import { apiClient } from './client';

export interface SimulationWarning {
  code: string;
  message: string;
}

export interface SimulationBaseline {
  sellingPricePaise: number;
  unitCostPaise: number;
  unitMarginPaise: number;
  periodDays: number;
  unitsSold: number;
  baselineProfitPaise: number;
}

export interface SimulationScenario {
  upliftPct: number;
  unitsSold: number;
  profitPaise: number;
  profitChangePct: number | null;
}

export interface DiscountSimulationResult {
  product: { id: string; name: string };
  baseline: SimulationBaseline;
  simulated: {
    discountedPricePaise: number;
    unitMarginPaise: number;
    marginChangePct: number | null;
  };
  breakEven: { unitsRequired: number; upliftRequiredPct: number } | null;
  scenarios: SimulationScenario[] | null;
  projection: SimulationScenario | null;
  warnings: SimulationWarning[];
}

export interface BogoSimulationResult {
  product: { id: string; name: string };
  baseline: SimulationBaseline;
  bundle: {
    buyQuantity: number;
    freeQuantity: number;
    bundleRevenuePaise: number;
    bundleCostPaise: number;
    bundleProfitPaise: number;
    effectiveDiscountPct: number;
    marginPerUnitMovedPaise: number;
  };
  breakEven: { bundlesRequired: number; unitsMoved: number; upliftRequiredPct: number } | null;
  hadRecentSales: boolean;
  warnings: SimulationWarning[];
}

export interface SimulateDiscountPayload {
  productId: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValueBps?: number;
  discountValuePaise?: number;
  periodDays?: number;
  expectedUpliftBps?: number;
}

export interface SimulateBogoPayload {
  productId: string;
  buyQuantity: number;
  freeQuantity: number;
  periodDays?: number;
}

export const SimulatorsClient = {
  simulateDiscount: (payload: SimulateDiscountPayload): Promise<DiscountSimulationResult> =>
    apiClient.post('/simulators/discount', payload),
  simulateBogo: (payload: SimulateBogoPayload): Promise<BogoSimulationResult> =>
    apiClient.post('/simulators/bogo', payload),
};
