"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PurchasesService, PurchaseOrder } from "@/lib/api-client/purchases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function PurchasesPage() {
  const { activeStore } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await PurchasesService.findAll();
      setOrders(data || []);
    } catch (e) {
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeStore?.id]);

  const handleReceive = async (id: string) => {
    try {
      await PurchasesService.receive(id);
      toast.success("Purchase Order received and stock injected!");
      fetchOrders();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to receive order");
    }
  };

  if (loading) return <div>Loading purchases...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchase Orders</h2>
          <p className="text-muted-foreground">Manage incoming stock from suppliers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/purchases/suppliers'}>
            Manage Suppliers
          </Button>
          <Button onClick={() => toast.info("New Purchase Order form coming soon!")}>
            Create PO
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3">Total Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(order.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{order.supplier?.name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{order.invoiceNumber || '-'}</td>
                      <td className="px-4 py-3 font-medium">₹{(order.totalPaise / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={order.status === 'RECEIVED' ? 'default' : 'outline'}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {order.status === 'DRAFT' && (
                          <Button size="sm" onClick={() => handleReceive(order.id)}>
                            Receive Stock
                          </Button>
                        )}
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
