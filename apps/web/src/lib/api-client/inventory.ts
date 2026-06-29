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

export const InventoryService = {
  getOverview: () => apiClient.get('/inventory'),
  getMovements: (productId?: string) => 
    apiClient.get(`/inventory/movements${productId ? `?productId=${productId}` : ''}`),
  createAdjustment: (data: { productId: string; batchId: string; quantityDelta: number; reason: string }) => 
    apiClient.post('/inventory/adjustments', data),
};
