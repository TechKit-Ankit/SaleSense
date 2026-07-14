"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { CustomersClient, Customer } from "@/lib/api-client/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CustomersPage() {
  const { activeStore } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!activeStore?.id) return;
    CustomersClient.list(q.trim() || undefined)
      .then((data) => setCustomers(data || []))
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false));
  }, [activeStore?.id, q]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const create = async () => {
    const phone = newPhone.replace(/\D/g, "");
    if (!newName.trim() && phone.length < 8) {
      toast.error("Enter a name or a valid phone number");
      return;
    }
    try {
      setBusy(true);
      await CustomersClient.create({
        ...(newName.trim() ? { name: newName.trim() } : {}),
        ...(phone.length >= 8 ? { phone } : {}),
      });
      toast.success("Customer added");
      setNewName(""); setNewPhone("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add customer");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div>Loading customers…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <p className="text-muted-foreground">
          Captured at the POS via the WhatsApp-number field, or added here. Powers paper-free bills.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add customer</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="border rounded-md px-3 py-2 text-sm flex-1"
          />
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="WhatsApp / phone number"
            className="border rounded-md px-3 py-2 text-sm flex-1"
          />
          <Button onClick={create} disabled={busy}>Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Customers {customers.length > 0 && `(${customers.length})`}</CardTitle>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="border rounded-md px-3 py-2 text-sm w-64"
          />
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customers yet. Ask for a WhatsApp number at checkout — the bill goes paper-free.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Loyalty points</th>
                    <th className="px-4 py-3">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{c.name ?? "—"}</td>
                      <td className="px-4 py-3">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3">{c.loyaltyPoints}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
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
