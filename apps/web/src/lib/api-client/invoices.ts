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
  /** Stateless public-share token (30d) — powers /r/[token] and the PDF. */
  shareToken?: string;
  /** Buyer identity (private payload only) — powers the wa.me direct chat. */
  customer?: { name: string | null; phone: string | null } | null;
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
