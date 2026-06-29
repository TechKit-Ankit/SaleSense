import { apiClient } from './client';
import { Supplier } from './suppliers';
import { Product } from './products';

export interface PurchaseItem {
  id: string;
  purchaseOrderId: string;
  storeId: string;
  productId: string;
  quantity: number;
  purchasePricePaise: number;
  mrpPaise: number | null;
  sellingPricePaise: number;
  taxRateBps: number;
  lineTotalPaise: number;
  batchNo: string | null;
  expiryDate: string | null;

  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  storeId: string;
  supplierId: string | null;
  invoiceNumber: string | null;
  purchaseDate: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED';
  createdByUserId: string;
  createdAt: string;

  supplier?: Supplier;
  items?: PurchaseItem[];
}

export const PurchasesService = {
  findAll: () => apiClient.get('/purchases'),
  findOne: (id: string) => apiClient.get(`/purchases/${id}`),
  create: (data: any) => apiClient.post('/purchases', data),
  receive: (id: string) => apiClient.patch(`/purchases/${id}/receive`, {}),
};
