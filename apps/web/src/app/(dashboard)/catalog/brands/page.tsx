"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { BrandsService, Brand } from "@/lib/api-client/brands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function BrandsPage() {
  const { activeStore } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrands = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await BrandsService.findAll();
      setBrands(data || []);
    } catch (e) {
      toast.error("Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [activeStore?.id]);

  if (loading) return <div>Loading brands...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Brands</h2>
          <p className="text-muted-foreground">Manage your product brands.</p>
        </div>
        <Button onClick={() => toast.info("Add brand form coming soon!")}>
          Add Brand
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Brands</CardTitle>
        </CardHeader>
        <CardContent>
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brands found.</p>
          ) : (
            <div className="divide-y">
              {brands.map((brand) => (
                <div key={brand.id} className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{brand.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      Status: {brand.status.toLowerCase()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
