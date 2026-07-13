"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";

interface PublicReceipt {
  invoiceNumber: string;
  status: string;
  issuedAt: string;
  store: { nameSnapshot: string; addressSnapshot: string | null; gstNumberSnapshot: string | null };
  sale: {
    subtotalPaise: number;
    discountPaise: number;
    taxPaise: number;
    totalPaise: number;
    items: { productNameSnapshot: string; quantity: number; unitSellingPricePaise: number; lineTotalPaise: number }[];
    payments: { method: string; amountPaise: number }[];
  };
}

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/**
 * Customer-facing bill: opened from the WhatsApp share link, no login
 * (design 0009 Gate 2 — the token in the URL is the authorization).
 * Deliberately does NOT use the authenticated apiClient.
 */
export default function PublicReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/public/receipts/${token}`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.success && body.data) setReceipt(body.data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-500">This bill link is invalid or has expired.</p>
      </div>
    );
  }
  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-400">Loading your bill…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-sm mx-auto space-y-3">
        <div className="bg-white border rounded-lg shadow-sm p-5 font-mono text-sm">
          <div className="text-center space-y-0.5">
            <p className="font-bold text-base">{receipt.store.nameSnapshot}</p>
            {receipt.store.addressSnapshot && <p className="text-xs">{receipt.store.addressSnapshot}</p>}
            {receipt.store.gstNumberSnapshot && <p className="text-xs">GSTIN: {receipt.store.gstNumberSnapshot}</p>}
          </div>

          <div className="border-t border-dashed my-2" />
          <div className="flex justify-between text-xs">
            <span>{receipt.invoiceNumber}</span>
            <span>{new Date(receipt.issuedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
          {receipt.status === "CANCELLED" && (
            <p className="text-center font-bold text-red-600 my-1">*** CANCELLED ***</p>
          )}
          <div className="border-t border-dashed my-2" />

          <table className="w-full text-xs">
            <tbody>
              {receipt.sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="pr-1">{item.quantity} × {item.productNameSnapshot}</td>
                  <td className="text-right">{(item.lineTotalPaise / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed my-2" />
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{rupees(receipt.sale.subtotalPaise)}</span></div>
            {receipt.sale.discountPaise > 0 && (
              <div className="flex justify-between"><span>Discount</span><span>-{rupees(receipt.sale.discountPaise)}</span></div>
            )}
            {receipt.sale.taxPaise > 0 && (
              <div className="flex justify-between"><span>Tax</span><span>{rupees(receipt.sale.taxPaise)}</span></div>
            )}
          </div>
          <div className="border-t border-dashed my-2" />
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{rupees(receipt.sale.totalPaise)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>Paid via</span>
            <span>{receipt.sale.payments.map((p) => p.method).join(", ")}</span>
          </div>
          <div className="border-t border-dashed my-2" />
          <p className="text-center text-xs">Thank you for shopping with us!</p>
        </div>

        <a
          href={`${API_BASE}/public/receipts/${token}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="block text-center bg-gray-900 text-white rounded-md py-2 text-sm font-medium"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
