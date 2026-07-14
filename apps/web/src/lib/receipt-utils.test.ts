import { waTarget, buildWhatsAppText, gstBreakup } from './receipt-utils';
import type { ReceiptInvoice } from './api-client/invoices';

const invoice: ReceiptInvoice = {
  id: 'inv_1',
  shareToken: 'tok123',
  customer: { name: 'Asha', phone: '9812345678' },
  invoiceNumber: 'INV-2026-2027-00002',
  financialYear: '2026-2027',
  status: 'ISSUED',
  issuedAt: '2026-07-12T10:30:00.000Z',
  store: { nameSnapshot: 'Test Store', addressSnapshot: null, gstNumberSnapshot: 'GST123' },
  sale: {
    id: 's1',
    createdAt: '2026-07-12T10:30:00.000Z',
    paymentStatus: 'PAID',
    subtotalPaise: 20000,
    discountPaise: 1000,
    taxPaise: 950,
    totalPaise: 19950,
    items: [
      { productNameSnapshot: 'Soap', hsnCodeSnapshot: null, quantity: 2, unitSellingPricePaise: 5000, discountPaise: 0, taxRateBps: 500, taxPaise: 500, lineTotalPaise: 10500 },
      { productNameSnapshot: 'Oil', hsnCodeSnapshot: null, quantity: 1, unitSellingPricePaise: 10000, discountPaise: 1000, taxRateBps: 500, taxPaise: 450, lineTotalPaise: 9450 },
    ],
    payments: [{ method: 'UPI', amountPaise: 19950 }],
  },
};

describe('waTarget', () => {
  it('prefixes 91 for bare Indian 10-digit numbers', () => {
    expect(waTarget('9812345678')).toBe('919812345678');
  });
  it('keeps numbers that already carry a country code', () => {
    expect(waTarget('919812345678')).toBe('919812345678');
  });
  it('strips formatting characters', () => {
    expect(waTarget('+91 98123-45678')).toBe('919812345678');
  });
  it('returns empty for missing/junk input (falls back to contact picker)', () => {
    expect(waTarget(null)).toBe('');
    expect(waTarget('abc')).toBe('');
  });
});

describe('buildWhatsAppText', () => {
  it('contains the bill essentials and the public /r/ link', () => {
    const text = buildWhatsAppText(invoice, 'https://shop.example');
    expect(text).toContain('*Test Store*');
    expect(text).toContain('GSTIN: GST123');
    expect(text).toContain('Invoice: INV-2026-2027-00002');
    expect(text).toContain('2 x Soap — ₹105.00');
    expect(text).toContain('Discount: -₹10.00');
    expect(text).toContain('*Total: ₹199.50*');
    expect(text).toContain('View your bill: https://shop.example/r/tok123');
  });

  it('omits the link when no share token exists', () => {
    const { shareToken: _omit, ...withoutToken } = invoice;
    const text = buildWhatsAppText(withoutToken, 'https://shop.example');
    expect(text).not.toContain('/r/');
  });
});

describe('gstBreakup', () => {
  it('groups tax by rate across items', () => {
    expect(gstBreakup(invoice)).toEqual([{ rateBps: 500, taxPaise: 950 }]);
  });
  it('returns empty when nothing is taxed', () => {
    const untaxed = {
      ...invoice,
      sale: { ...invoice.sale, items: invoice.sale.items.map((i) => ({ ...i, taxPaise: 0 })) },
    };
    expect(gstBreakup(untaxed)).toEqual([]);
  });
});
