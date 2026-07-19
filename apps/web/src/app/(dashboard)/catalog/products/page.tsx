"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { ProductsService, Product } from "@/lib/api-client/products";
import { CategoriesService, Category } from "@/lib/api-client/categories";
import { BrandsService, Brand } from "@/lib/api-client/brands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ProductsPage() {
  const { activeStore } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-product form (inline, matches the lightweight Customers-page pattern).
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sellingPrice: "", // rupees, converted to paise on submit
    mrp: "",
    taxRate: "", // percent, converted to basis points
    sku: "",
    barcode: "",
    categoryId: "",
    brandId: "",
  });

  const fetchProducts = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await ProductsService.findAll();
      setProducts(data || []);
    } catch (e) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeStore?.id) return;
    fetchProducts();
    // Dropdown sources; failures are non-fatal (a product can be created without them).
    CategoriesService.findAll().then((d: Category[]) => setCategories(d || [])).catch(() => {});
    BrandsService.findAll().then((d: Brand[]) => setBrands(d || [])).catch(() => {});
  }, [activeStore?.id]);

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const resetForm = () =>
    setForm({ name: "", sellingPrice: "", mrp: "", taxRate: "", sku: "", barcode: "", categoryId: "", brandId: "" });

  const submit = async () => {
    const price = Number(form.sellingPrice);
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid selling price");
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      sellingPricePaise: Math.round(price * 100),
    };
    if (form.mrp && Number(form.mrp) > 0) payload.mrpPaise = Math.round(Number(form.mrp) * 100);
    if (form.taxRate && Number(form.taxRate) >= 0) payload.taxRateBps = Math.round(Number(form.taxRate) * 100);
    if (form.sku.trim()) payload.sku = form.sku.trim();
    if (form.barcode.trim()) payload.barcode = form.barcode.trim();
    if (form.categoryId) payload.categoryId = form.categoryId;
    if (form.brandId) payload.brandId = form.brandId;

    try {
      setSaving(true);
      await ProductsService.create(payload);
      toast.success(`Added ${payload.name}`);
      resetForm();
      setShowForm(false);
      fetchProducts();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">Manage your product catalog.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "Add Product"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New product</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Name *</label>
              <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Amul Milk 500ml" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Selling price (₹) *</label>
              <input type="number" min={0} step="0.01" value={form.sellingPrice} onChange={(e) => setField("sellingPrice", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="30.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">MRP (₹)</label>
              <input type="number" min={0} step="0.01" value={form.mrp} onChange={(e) => setField("mrp", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="32.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Tax rate (%)</label>
              <input type="number" min={0} step="0.1" value={form.taxRate} onChange={(e) => setField("taxRate", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="5" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">SKU</label>
              <input value={form.sku} onChange={(e) => setField("sku", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="MILK-AMUL-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Barcode</label>
              <input value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="8900000000012" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Category</label>
              <select value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Brand</label>
              <select value={form.brandId} onChange={(e) => setField("brandId", e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                <option value="">— none —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={submit} disabled={saving} className="w-full md:w-auto">
                {saving ? "Saving…" : "Save product"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {product.name}
                        {product.barcodes && product.barcodes.length > 0 && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {product.barcodes.length} Barcodes
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{product.sku || '-'}</td>
                      <td className="px-4 py-3">₹{(product.sellingPricePaise / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">{product.category?.name || '-'}</td>
                      <td className="px-4 py-3">{product.brand?.name || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm">Edit</Button>
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
