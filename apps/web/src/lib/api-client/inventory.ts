import { apiClient } from './client';
import { Product } from './products';

export interface InventoryBatch {
  id: string;
  storeId: string;
  productId: string;
  purchaseItemId: string | null;
  batchNo: string | null;
  purchasePricePaise: number;
  mrpPaise: number | null;
  sellingPricePaise: number;
  expiryDate: string | null;
  initialQuantity: number;
  currentQuantity: number;
  status: string;
  createdAt: string;
  updatedAt: string;

  product?: Product;
}

export interface StockMovement {
  id: string;
  storeId: string;
  productId: string;
  batchId: string | null;
  type: string;
  quantityDelta: number;
  quantityAfter: number | null;
  reason: string | null;
  createdAt: string;

  product?: Product;
  createdByUser?: {
    id: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface ReconciliationItem {
  movementId: string;
  type: string;
  quantityDelta: number;
  quantityAfter: number | null;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  product: { id: string; name: string } | null;
  batch: { id: string; batchNo: string | null; currentQuantity: number } | null;
}

export interface ResolveReconciliationPayload {
  action: 'ADJUST' | 'DISMISS';
  countedQuantity?: number;
  reason: string;
}

export const InventoryService = {
  getOverview: () => apiClient.get('/inventory'),
  getMovements: (productId?: string) =>
    apiClient.get(`/inventory/movements${productId ? `?productId=${productId}` : ''}`),
  createAdjustment: (data: { productId: string; batchId: string; quantityDelta: number; reason: string }) =>
    apiClient.post('/inventory/adjustments', data),
  getReconciliation: (): Promise<ReconciliationItem[]> =>
    apiClient.get('/inventory/reconciliation'),
  resolveReconciliation: (movementId: string, payload: ResolveReconciliationPayload) =>
    apiClient.post(`/inventory/reconciliation/${movementId}/resolve`, payload),
};
