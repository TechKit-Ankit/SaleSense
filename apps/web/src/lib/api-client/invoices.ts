import { apiClient } from './client';

export interface ReceiptItem {
  productNameSnapshot: string;
  hsnCodeSnapshot: string | null;
  quantity: number;
  unitSellingPricePaise: number;
  discountPaise: number;
  taxRateBps: number;
  taxPaise: number;
  lineTotalPaise: number;
}

export interface ReceiptInvoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  status: 'ISSUED' | 'CANCELLED';
  issuedAt: string;
  store: {
    nameSnapshot: string;
    addressSnapshot: string | null;
    gstNumberSnapshot: string | null;
  };
  sale: {
    id: string;
    createdAt: string;
    paymentStatus: string;
    subtotalPaise: number;
    discountPaise: number;
    taxPaise: number;
    totalPaise: number;
    items: ReceiptItem[];
    payments: { method: string; amountPaise: number }[];
  };
}

export const InvoicesClient = {
  getInvoice: (invoiceId: string): Promise<ReceiptInvoice> =>
    apiClient.get(`/invoices/${invoiceId}`),
};
