"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { InventoryService, InventoryBatch } from "@/lib/api-client/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function InventoryPage() {
  const { activeStore } = useAuth();
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await InventoryService.getOverview();
      setBatches(data || []);
    } catch (e) {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [activeStore?.id]);

  if (loading) return <div>Loading inventory...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
          <p className="text-muted-foreground">Manage your current stock levels.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/inventory/movements'}>
            View Movements
          </Button>
          <Button onClick={() => toast.info("Stock Adjustment form coming soon!")}>
            Adjust Stock
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Stock Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active inventory found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch No</th>
                    <th className="px-4 py-3">Current Qty</th>
                    <th className="px-4 py-3">Cost Price</th>
                    <th className="px-4 py-3">Selling Price</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{batch.product?.name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{batch.batchNo || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={batch.currentQuantity < 10 ? 'destructive' : 'secondary'}>
                          {batch.currentQuantity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">₹{(batch.purchasePricePaise / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">₹{(batch.sellingPricePaise / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{batch.status}</Badge>
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
