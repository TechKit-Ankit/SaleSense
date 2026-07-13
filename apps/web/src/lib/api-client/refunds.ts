import { apiClient } from './client';

export interface RefundItemInput {
  saleItemId: string;
  quantity: number;
  restock?: boolean;
}

export interface Refund {
  id: string;
  saleId: string;
  reason: string;
  refundAmountPaise: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  approvedAt: string | null;
  items?: { saleItemId: string; quantity: number; restock: boolean; refundAmountPaise: number; saleItem?: { productNameSnapshot: string } }[];
  sale?: { id: string; createdAt: string; totalPaise: number; invoice?: { invoiceNumber: string } | null };
  createdByUser?: { id: string; name: string } | null;
  approvedByUser?: { id: string; name: string } | null;
}

export const RefundsClient = {
  requestRefund: (saleId: string, payload: { reason: string; items: RefundItemInput[] }): Promise<Refund> =>
    apiClient.post(`/sales/${saleId}/refunds`, payload),
  list: (): Promise<Refund[]> => apiClient.get('/refunds'),
  get: (refundId: string): Promise<Refund> => apiClient.get(`/refunds/${refundId}`),
  approve: (refundId: string): Promise<Refund> => apiClient.post(`/refunds/${refundId}/approve`),
  reject: (refundId: string): Promise<Refund> => apiClient.post(`/refunds/${refundId}/reject`),
  complete: (refundId: string): Promise<Refund> => apiClient.post(`/refunds/${refundId}/complete`),
};
