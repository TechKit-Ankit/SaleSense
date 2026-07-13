import { apiClient as api } from './client';

export interface SaleItemPayload {
  productId: string;
  batchId?: string;
  quantity: number;
  unitSellingPricePaise: number;
  discountPaise?: number;
}

export interface SalePaymentPayload {
  method: 'CASH' | 'UPI' | 'CARD';
  amountPaise: number;
}

export interface CreateSalePayload {
  customerId?: string;
  deviceId?: string;
  idempotencyKey: string;
  clientSaleId: string;
  saleSource: 'ONLINE' | 'OFFLINE_SYNC' | 'IMPORT';
  items: SaleItemPayload[];
  payments: SalePaymentPayload[];
}

export interface SyncWarning {
  code: string;
  message: string;
}

export interface SyncedSaleResult {
  clientSaleId: string | null;
  clientMutationId: string;
  saleId: string;
  invoiceId: string | null;
  status: 'SYNCED';
  requiresReconciliation: boolean;
  warnings: SyncWarning[];
}

export interface FailedSaleResult {
  clientSaleId: string | null;
  clientMutationId: string;
  status: 'FAILED';
  error: { code: string; message: string };
}

export interface SyncSalesResult {
  synced: SyncedSaleResult[];
  failed: FailedSaleResult[];
}

export interface SaleListEntry {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  saleSource: string;
  invoice?: { id: string; invoiceNumber: string } | null;
  refunds: { id: string; status: string; refundAmountPaise: number }[];
  _count: { items: number };
}

export interface SaleDetailItem {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  unitSellingPricePaise: number;
  lineTotalPaise: number;
  refundableQuantity: number;
  batchId: string | null;
}

export interface SaleDetail {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  invoice?: { id: string; invoiceNumber: string } | null;
  items: SaleDetailItem[];
  payments: { method: string; amountPaise: number }[];
  refunds: {
    id: string;
    status: string;
    reason: string;
    refundAmountPaise: number;
    createdAt: string;
    items: { saleItemId: string; quantity: number }[];
  }[];
}

export const SalesClient = {
  // Note: `api.post` already unwraps the response envelope and returns `data`.
  createSale: (storeId: string, payload: CreateSalePayload) =>
    api.post(`/sales`, payload, { headers: { 'x-store-id': storeId } }),

  listSales: (): Promise<SaleListEntry[]> => api.get('/sales'),
  getSale: (saleId: string): Promise<SaleDetail> => api.get(`/sales/${saleId}`),

  syncSales: (storeId: string, sales: CreateSalePayload[]): Promise<SyncSalesResult> =>
    api.post(`/sales/sync`, { sales }, { headers: { 'x-store-id': storeId } }),
};
