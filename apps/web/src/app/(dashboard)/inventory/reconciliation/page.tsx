"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { InventoryService, ReconciliationItem } from "@/lib/api-client/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function InventoryReconciliationPage() {
  const { activeStore } = useAuth();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!activeStore?.id) return;
    try {
      const data = await InventoryService.getReconciliation();
      setItems(data || []);
    } catch (e) {
      toast.error("Failed to load reconciliation items");
    } finally {
      setLoading(false);
    }
  }, [activeStore?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdjust = async (item: ReconciliationItem) => {
    const countedRaw = window.prompt(
      `Physical count for ${item.product?.name ?? "product"} (batch ${item.batch?.batchNo ?? "-"}).\nSystem currently shows: ${item.batch?.currentQuantity ?? "?"}`,
    );
    if (countedRaw === null) return;
    const countedQuantity = Number(countedRaw);
    if (!Number.isInteger(countedQuantity) || countedQuantity < 0) {
      toast.error("Counted quantity must be a whole number ≥ 0");
      return;
    }
    const reason = window.prompt("Reason (required, kept in the audit trail):");
    if (!reason?.trim()) {
      toast.error("A reason is required");
      return;
    }
    await resolve(item.movementId, { action: "ADJUST", countedQuantity, reason: reason.trim() });
  };

  const handleDismiss = async (item: ReconciliationItem) => {
    const reason = window.prompt(
      "Why is no stock change needed? (required, kept in the audit trail)",
    );
    if (!reason?.trim()) {
      toast.error("A reason is required");
      return;
    }
    await resolve(item.movementId, { action: "DISMISS", reason: reason.trim() });
  };

  const resolve = async (
    movementId: string,
    payload: { action: "ADJUST" | "DISMISS"; countedQuantity?: number; reason: string },
  ) => {
    try {
      setResolving(movementId);
      await InventoryService.resolveReconciliation(movementId, payload);
      toast.success(payload.action === "ADJUST" ? "Stock adjusted and item resolved" : "Item dismissed");
      setItems((prev) => prev.filter((i) => i.movementId !== movementId));
    } catch (e: any) {
      toast.error(e?.message || "Failed to resolve item");
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <div>Loading reconciliation items...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Reconciliation</h2>
          <p className="text-muted-foreground">
            Offline sales that drove stock negative. Do a physical count, then adjust or dismiss.
          </p>
        </div>
        <Button variant="outline" onClick={() => (window.location.href = "/inventory")}>
          Back to Overview
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs Review {items.length > 0 && <Badge variant="destructive">{items.length}</Badge>}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to reconcile. Offline sales that oversell stock will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Movement</th>
                    <th className="px-4 py-3">Live Qty</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.movementId} className="border-b last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.product?.name ?? "—"}</td>
                      <td className="px-4 py-3">{item.batch?.batchNo ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{item.type}</Badge>{" "}
                        <span className="text-red-600 font-medium">{item.quantityDelta}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={(item.batch?.currentQuantity ?? 0) < 0 ? "text-red-600 font-bold" : ""}>
                          {item.batch?.currentQuantity ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          disabled={resolving === item.movementId}
                          onClick={() => handleAdjust(item)}
                        >
                          Adjust
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolving === item.movementId}
                          onClick={() => handleDismiss(item)}
                        >
                          Dismiss
                        </Button>
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
