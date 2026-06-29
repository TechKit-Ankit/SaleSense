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

export const SalesClient = {
  createSale: async (storeId: string, payload: CreateSalePayload) => {
    const res = await api.post(`/sales`, payload, {
      headers: { 'x-store-id': storeId },
    });
    return res.data;
  },

  syncSales: async (storeId: string, sales: CreateSalePayload[]) => {
    const res = await api.post(`/sales/sync`, { sales }, {
      headers: { 'x-store-id': storeId },
    });
    return res.data;
  },
};
