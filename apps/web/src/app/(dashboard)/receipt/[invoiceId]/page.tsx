"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { InvoicesClient, ReceiptInvoice } from "@/lib/api-client/invoices";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Printer, MessageCircle, ArrowLeft, FileDown } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/** wa.me needs country code + digits only; bare 10-digit numbers assume India. */
function waTarget(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Plain-text receipt for the WhatsApp deep link (paper-free bill). */
function buildWhatsAppText(inv: ReceiptInvoice): string {
  const lines: string[] = [];
  lines.push(`*${inv.store.nameSnapshot}*`);
  if (inv.store.addressSnapshot) lines.push(inv.store.addressSnapshot);
  if (inv.store.gstNumberSnapshot) lines.push(`GSTIN: ${inv.store.gstNumberSnapshot}`);
  lines.push(`Invoice: ${inv.invoiceNumber}`);
  lines.push(`Date: ${new Date(inv.issuedAt).toLocaleString("en-IN")}`);
  lines.push("------------------------");
  for (const item of inv.sale.items) {
    lines.push(`${item.quantity} x ${item.productNameSnapshot} — ${rupees(item.lineTotalPaise)}`);
  }
  lines.push("------------------------");
  if (inv.sale.discountPaise > 0) lines.push(`Discount: -${rupees(inv.sale.discountPaise)}`);
  if (inv.sale.taxPaise > 0) lines.push(`Tax: ${rupees(inv.sale.taxPaise)}`);
  lines.push(`*Total: ${rupees(inv.sale.totalPaise)}*`);
  lines.push(`Paid via: ${inv.sale.payments.map((p) => p.method).join(", ")}`);
  // Paper-free bill: the customer opens their own copy (design 0009 Gate 2).
  if (inv.shareToken) {
    lines.push(`View your bill: ${window.location.origin}/r/${inv.shareToken}`);
  }
  lines.push("Thank you for shopping with us!");
  return lines.join("\n");
}

/** Groups tax by rate for the GST breakup block (test-strategy scenario 7). */
function gstBreakup(inv: ReceiptInvoice): { rateBps: number; taxPaise: number }[] {
  const byRate = new Map<number, number>();
  for (const item of inv.sale.items) {
    if (item.taxPaise > 0) {
      byRate.set(item.taxRateBps, (byRate.get(item.taxRateBps) ?? 0) + item.taxPaise);
    }
  }
  return [...byRate.entries()].map(([rateBps, taxPaise]) => ({ rateBps, taxPaise }));
}

export default function ReceiptPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { activeStore } = useAuth();
  const [invoice, setInvoice] = useState<ReceiptInvoice | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activeStore?.id || !invoiceId) return;
    InvoicesClient.getInvoice(invoiceId)
      .then(setInvoice)
      .catch(() => {
        setError(true);
        toast.error("Receipt not found");
      });
  }, [activeStore?.id, invoiceId]);

  if (error) return <div className="p-6">Receipt not found for this store.</div>;
  if (!invoice) return <div className="p-6">Loading receipt…</div>;

  const breakup = invoice.store.gstNumberSnapshot ? gstBreakup(invoice) : [];

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Print rules: only the receipt area prints, on plain white. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-area, #receipt-area * { visibility: visible; }
          #receipt-area { position: absolute; left: 0; top: 0; width: 80mm; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => (window.location.href = "/pos")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to POS
        </Button>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-green-700 border-green-300"
            onClick={() => {
              // Customer captured at POS → open THEIR chat directly (one Send
              // tap, design 0012); otherwise fall back to the contact picker.
              const target = waTarget(invoice.customer?.phone);
              window.open(
                `https://wa.me/${target}?text=${encodeURIComponent(buildWhatsAppText(invoice))}`,
                "_blank",
              );
            }}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            {invoice.customer?.phone ? `WhatsApp ${invoice.customer.name ?? invoice.customer.phone}` : "Share on WhatsApp"}
          </Button>
          {invoice.shareToken && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`${API_BASE}/public/receipts/${invoice.shareToken}/pdf`, "_blank")}
            >
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>

      <div id="receipt-area" className="bg-white border rounded-lg shadow-sm p-5 font-mono text-sm" style={{ maxWidth: "320px", margin: "0 auto" }}>
        <div className="text-center space-y-0.5">
          <p className="font-bold text-base">{invoice.store.nameSnapshot}</p>
          {invoice.store.addressSnapshot && <p className="text-xs">{invoice.store.addressSnapshot}</p>}
          {invoice.store.gstNumberSnapshot && <p className="text-xs">GSTIN: {invoice.store.gstNumberSnapshot}</p>}
        </div>

        <div className="border-t border-dashed my-2" />
        <div className="flex justify-between text-xs">
          <span>{invoice.invoiceNumber}</span>
          <span>{new Date(invoice.issuedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
        {invoice.status === "CANCELLED" && (
          <p className="text-center font-bold text-red-600 my-1">*** CANCELLED ***</p>
        )}
        <div className="border-t border-dashed my-2" />

        <table className="w-full text-xs">
          <thead>
            <tr className="text-left">
              <th className="font-normal">Item</th>
              <th className="font-normal text-right">Qty</th>
              <th className="font-normal text-right">Rate</th>
              <th className="font-normal text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.sale.items.map((item, i) => (
              <tr key={i}>
                <td className="pr-1">{item.productNameSnapshot}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">{(item.unitSellingPricePaise / 100).toFixed(2)}</td>
                <td className="text-right">{(item.lineTotalPaise / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed my-2" />
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between"><span>Subtotal</span><span>{rupees(invoice.sale.subtotalPaise)}</span></div>
          {invoice.sale.discountPaise > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-{rupees(invoice.sale.discountPaise)}</span></div>
          )}
          {breakup.map((b) => (
            <div key={b.rateBps} className="flex justify-between">
              <span>GST @ {(b.rateBps / 100).toFixed(1)}%</span>
              <span>{rupees(b.taxPaise)}</span>
            </div>
          ))}
          {invoice.sale.taxPaise > 0 && breakup.length === 0 && (
            <div className="flex justify-between"><span>Tax</span><span>{rupees(invoice.sale.taxPaise)}</span></div>
          )}
        </div>
        <div className="border-t border-dashed my-2" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{rupees(invoice.sale.totalPaise)}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span>Paid via</span>
          <span>{invoice.sale.payments.map((p) => `${p.method} ${rupees(p.amountPaise)}`).join(", ")}</span>
        </div>

        <div className="border-t border-dashed my-2" />
        <p className="text-center text-xs">Thank you for shopping with us!</p>
      </div>
    </div>
  );
}
