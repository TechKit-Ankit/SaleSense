import { ReceiptInvoice } from './api-client/invoices';

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/** wa.me needs country code + digits only; bare 10-digit numbers assume India. */
export function waTarget(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Plain-text receipt for the WhatsApp deep link (paper-free bill).
 * `origin` is the web app origin for the public /r/ link.
 */
export function buildWhatsAppText(inv: ReceiptInvoice, origin: string): string {
  const lines: string[] = [];
  lines.push(`*${inv.store.nameSnapshot}*`);
  if (inv.store.addressSnapshot) lines.push(inv.store.addressSnapshot);
  if (inv.store.gstNumberSnapshot) lines.push(`GSTIN: ${inv.store.gstNumberSnapshot}`);
  lines.push(`Invoice: ${inv.invoiceNumber}`);
  lines.push(`Date: ${new Date(inv.issuedAt).toLocaleString('en-IN')}`);
  lines.push('------------------------');
  for (const item of inv.sale.items) {
    lines.push(`${item.quantity} x ${item.productNameSnapshot} — ${rupees(item.lineTotalPaise)}`);
  }
  lines.push('------------------------');
  if (inv.sale.discountPaise > 0) lines.push(`Discount: -${rupees(inv.sale.discountPaise)}`);
  if (inv.sale.taxPaise > 0) lines.push(`Tax: ${rupees(inv.sale.taxPaise)}`);
  lines.push(`*Total: ${rupees(inv.sale.totalPaise)}*`);
  lines.push(`Paid via: ${inv.sale.payments.map((p) => p.method).join(', ')}`);
  // Paper-free bill: the customer opens their own copy (design 0009 Gate 2).
  if (inv.shareToken) {
    lines.push(`View your bill: ${origin}/r/${inv.shareToken}`);
  }
  lines.push('Thank you for shopping with us!');
  return lines.join('\n');
}

/** Groups tax by rate for the GST breakup block (test-strategy scenario 7). */
export function gstBreakup(inv: ReceiptInvoice): { rateBps: number; taxPaise: number }[] {
  const byRate = new Map<number, number>();
  for (const item of inv.sale.items) {
    if (item.taxPaise > 0) {
      byRate.set(item.taxRateBps, (byRate.get(item.taxRateBps) ?? 0) + item.taxPaise);
    }
  }
  return [...byRate.entries()].map(([rateBps, taxPaise]) => ({ rateBps, taxPaise }));
}
