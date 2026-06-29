"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { SuppliersService, Supplier } from "@/lib/api-client/suppliers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function SuppliersPage() {
  const { activeStore } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await SuppliersService.findAll();
      setSuppliers(data || []);
    } catch (e) {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [activeStore?.id]);

  if (loading) return <div>Loading suppliers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suppliers</h2>
          <p className="text-muted-foreground">Manage your distributors and vendors.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => toast.info("Add Supplier form coming soon!")}>
            Add Supplier
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppliers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">GST Number</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{supplier.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{supplier.phone || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{supplier.gstNumber || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={supplier.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {supplier.status}
                        </Badge>
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
