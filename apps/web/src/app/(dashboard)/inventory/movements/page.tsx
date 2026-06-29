"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { InventoryService, StockMovement } from "@/lib/api-client/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function InventoryMovementsPage() {
  const { activeStore } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await InventoryService.getMovements();
      setMovements(data || []);
    } catch (e) {
      toast.error("Failed to load stock movements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [activeStore?.id]);

  if (loading) return <div>Loading movements...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Movements</h2>
          <p className="text-muted-foreground">Ledger of all inventory changes.</p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/inventory'}>
          Back to Overview
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Delta</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(mov.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{mov.product?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{mov.type.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={mov.quantityDelta > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {mov.quantityDelta > 0 ? '+' : ''}{mov.quantityDelta}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{mov.quantityAfter ?? '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{mov.reason || '-'}</td>
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
