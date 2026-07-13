"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { SalesClient, SaleListEntry } from "@/lib/api-client/sales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPaise } from "@/lib/utils/formatters";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
  REFUNDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
  PENDING_SYNC: "bg-blue-100 text-blue-700",
};

export default function SalesHistoryPage() {
  const { activeStore } = useAuth();
  const [sales, setSales] = useState<SaleListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore?.id) return;
    SalesClient.listSales()
      .then((data) => setSales(data || []))
      .catch(() => toast.error("Failed to load sales"))
      .finally(() => setLoading(false));
  }, [activeStore?.id]);

  if (loading) return <div>Loading sales…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sales</h2>
        <p className="text-muted-foreground">Recent sales — open one to view items, print, or refund.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest {sales.length} sales</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Refunds</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => (window.location.href = `/sales/${sale.id}`)}
                    >
                      <td className="px-4 py-3 font-medium">{sale.invoice?.invoiceNumber ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(sale.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">{sale._count.items}</td>
                      <td className="px-4 py-3 font-medium">{formatPaise(sale.totalPaise)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[sale.status] ?? ""}`}>
                          {sale.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {sale.refunds.length > 0 ? <Badge variant="outline">{sale.refunds.length}</Badge> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
