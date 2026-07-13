"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { SalesClient, SaleDetail } from "@/lib/api-client/sales";
import { RefundsClient } from "@/lib/api-client/refunds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPaise } from "@/lib/utils/formatters";
import { ArrowLeft, Printer } from "lucide-react";

export default function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const { activeStore, storeMemberships } = useAuth();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [refundQty, setRefundQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const role = storeMemberships.find((m) => m.storeId === activeStore?.id)?.role;
  const canApprove = role === "OWNER" || role === "MANAGER";

  const load = useCallback(() => {
    if (!activeStore?.id || !saleId) return;
    SalesClient.getSale(saleId)
      .then(setSale)
      .catch(() => toast.error("Sale not found"));
  }, [activeStore?.id, saleId]);

  useEffect(() => { load(); }, [load]);

  if (!sale) return <div>Loading sale…</div>;

  const requestable = sale.items.filter((i) => i.refundableQuantity > 0);
  const anySelected = Object.values(refundQty).some((q) => q > 0);

  const submitRefund = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required — refunds are audited");
      return;
    }
    const items = Object.entries(refundQty)
      .filter(([, q]) => q > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity, restock: restock[saleItemId] ?? true }));
    try {
      setBusy(true);
      await RefundsClient.requestRefund(sale.id, { reason: reason.trim(), items });
      toast.success("Refund requested — awaiting approval");
      setRefundQty({}); setReason("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Refund request failed");
    } finally {
      setBusy(false);
    }
  };

  const act = async (refundId: string, action: "approve" | "reject" | "complete") => {
    try {
      setBusy(true);
      await RefundsClient[action](refundId);
      toast.success(`Refund ${action}d`);
      load();
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{sale.invoice?.invoiceNumber ?? "Sale"}</h2>
          <p className="text-muted-foreground">
            {new Date(sale.createdAt).toLocaleString("en-IN")} · {sale.status.replaceAll("_", " ")} · {formatPaise(sale.totalPaise)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => (window.location.href = "/sales")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Sales
          </Button>
          {sale.invoice?.id && (
            <Button size="sm" onClick={() => window.open(`/receipt/${sale.invoice!.id}`, "_blank")}>
              <Printer className="h-4 w-4 mr-1" /> Receipt
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Line total</th>
                <th className="px-3 py-2 text-right">Refundable</th>
                <th className="px-3 py-2 text-right">Refund qty</th>
                <th className="px-3 py-2 text-right">Restock</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{item.productNameSnapshot}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatPaise(item.lineTotalPaise)}</td>
                  <td className="px-3 py-2 text-right">{item.refundableQuantity}</td>
                  <td className="px-3 py-2 text-right">
                    {item.refundableQuantity > 0 ? (
                      <input
                        type="number"
                        min={0}
                        max={item.refundableQuantity}
                        value={refundQty[item.id] ?? 0}
                        onChange={(e) =>
                          setRefundQty((p) => ({ ...p, [item.id]: Math.min(Number(e.target.value) || 0, item.refundableQuantity) }))
                        }
                        className="border rounded px-2 py-1 w-16 text-right"
                      />
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.refundableQuantity > 0 && item.batchId ? (
                      <input
                        type="checkbox"
                        checked={restock[item.id] ?? true}
                        onChange={(e) => setRestock((p) => ({ ...p, [item.id]: e.target.checked }))}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {requestable.length > 0 && (
            <div className="flex flex-col md:flex-row gap-2 mt-4 items-start md:items-end">
              <div className="flex-1 w-full">
                <label className="text-sm font-medium">Refund reason (audited)</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. damaged packaging"
                  className="border rounded-md px-3 py-2 text-sm w-full mt-1"
                />
              </div>
              <Button disabled={!anySelected || busy} onClick={submitRefund}>
                Request refund
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {sale.refunds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Refunds</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sale.refunds.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {formatPaise(r.refundAmountPaise)} · {r.items.reduce((s, i) => s + i.quantity, 0)} unit(s)
                    <Badge variant="outline" className="ml-2">{r.status.replaceAll("_", " ")}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.reason} · {new Date(r.createdAt).toLocaleString("en-IN")}</p>
                </div>
                {canApprove && r.status === "PENDING_APPROVAL" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => act(r.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r.id, "reject")}>Reject</Button>
                  </div>
                )}
                {canApprove && r.status === "APPROVED" && (
                  <Button size="sm" disabled={busy} onClick={() => act(r.id, "complete")}>Complete refund</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
