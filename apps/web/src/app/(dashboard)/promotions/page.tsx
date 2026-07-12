"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { ProductsService, Product } from "@/lib/api-client/products";
import {
  SimulatorsClient,
  DiscountSimulationResult,
  BogoSimulationResult,
} from "@/lib/api-client/simulators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPaise } from "@/lib/utils/formatters";

type Mode = "DISCOUNT" | "BOGO";

export default function PromotionsPage() {
  const { activeStore } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState<Mode>("DISCOUNT");
  const [running, setRunning] = useState(false);

  // Discount inputs (owner-friendly units; converted to bps/paise for the API)
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("10"); // % or ₹
  const [expectedUplift, setExpectedUplift] = useState(""); // optional %

  // BOGO inputs
  const [buyQty, setBuyQty] = useState("2");
  const [freeQty, setFreeQty] = useState("1");

  const [discountResult, setDiscountResult] = useState<DiscountSimulationResult | null>(null);
  const [bogoResult, setBogoResult] = useState<BogoSimulationResult | null>(null);

  useEffect(() => {
    if (!activeStore?.id) return;
    ProductsService.findAll()
      .then((data) => setProducts(data || []))
      .catch(() => toast.error("Failed to load products"));
  }, [activeStore?.id]);

  const run = async () => {
    if (!productId) {
      toast.error("Pick a product first");
      return;
    }
    setRunning(true);
    setDiscountResult(null);
    setBogoResult(null);
    try {
      if (mode === "DISCOUNT") {
        const value = Number(discountValue);
        if (!Number.isFinite(value) || value <= 0) {
          toast.error("Enter a valid discount value");
          return;
        }
        const uplift = expectedUplift.trim() === "" ? undefined : Math.round(Number(expectedUplift) * 100);
        const result = await SimulatorsClient.simulateDiscount({
          productId,
          discountType,
          ...(discountType === "PERCENTAGE"
            ? { discountValueBps: Math.round(value * 100) }
            : { discountValuePaise: Math.round(value * 100) }),
          ...(uplift !== undefined && Number.isFinite(uplift) ? { expectedUpliftBps: uplift } : {}),
        });
        setDiscountResult(result);
      } else {
        const result = await SimulatorsClient.simulateBogo({
          productId,
          buyQuantity: Number(buyQty),
          freeQuantity: Number(freeQty),
        });
        setBogoResult(result);
      }
    } catch (e: any) {
      toast.error(e?.message || "Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  const warningBanner = (warnings: { code: string; message: string }[]) =>
    warnings.length > 0 && (
      <div className="space-y-2">
        {warnings.map((w) => (
          <div
            key={w.code}
            className={`text-sm rounded-md px-3 py-2 border ${
              w.code === "NEVER_PROFITABLE"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            <span className="font-semibold">{w.code.replaceAll("_", " ")}:</span> {w.message}
          </div>
        ))}
      </div>
    );

  const baselineCard = (b: { sellingPricePaise: number; unitCostPaise: number; unitMarginPaise: number; unitsSold: number; periodDays: number; baselineProfitPaise: number }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
      <div><p className="text-muted-foreground">Selling price</p><p className="font-semibold">{formatPaise(b.sellingPricePaise)}</p></div>
      <div><p className="text-muted-foreground">Unit cost (weighted)</p><p className="font-semibold">{formatPaise(b.unitCostPaise)}</p></div>
      <div><p className="text-muted-foreground">Margin / unit</p><p className="font-semibold">{formatPaise(b.unitMarginPaise)}</p></div>
      <div><p className="text-muted-foreground">Sold (last {b.periodDays}d)</p><p className="font-semibold">{b.unitsSold} units</p></div>
      <div><p className="text-muted-foreground">Baseline profit</p><p className="font-semibold">{formatPaise(b.baselineProfitPaise)}</p></div>
    </div>
  );

  if (!activeStore) return <div>Select a store</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promotion Simulator</h2>
        <p className="text-muted-foreground">
          Test a discount or BOGO offer against your real cost and sales data before running it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set up the offer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Product</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm min-w-56"
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Offer type</label>
              <div className="flex gap-1">
                <Button size="sm" variant={mode === "DISCOUNT" ? "default" : "outline"} onClick={() => setMode("DISCOUNT")}>Discount</Button>
                <Button size="sm" variant={mode === "BOGO" ? "default" : "outline"} onClick={() => setMode("BOGO")}>Buy X Get Y Free</Button>
              </div>
            </div>

            {mode === "DISCOUNT" ? (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Discount</label>
                  <div className="flex gap-1 items-center">
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm w-24"
                      min={0}
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "PERCENTAGE" | "FLAT")}
                      className="border rounded-md px-2 py-2 text-sm"
                    >
                      <option value="PERCENTAGE">%</option>
                      <option value="FLAT">₹ off</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Expected sales boost % <span className="text-muted-foreground">(optional)</span></label>
                  <input
                    type="number"
                    value={expectedUplift}
                    onChange={(e) => setExpectedUplift(e.target.value)}
                    placeholder="e.g. 25"
                    className="border rounded-md px-3 py-2 text-sm w-28"
                    min={0}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Buy</label>
                  <input type="number" value={buyQty} onChange={(e) => setBuyQty(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-20" min={1} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Get free</label>
                  <input type="number" value={freeQty} onChange={(e) => setFreeQty(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-20" min={1} />
                </div>
              </>
            )}

            <Button onClick={run} disabled={running}>
              {running ? "Simulating…" : "Simulate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {discountResult && (
        <Card>
          <CardHeader>
            <CardTitle>Discount result — {discountResult.product.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {warningBanner(discountResult.warnings)}
            {baselineCard(discountResult.baseline)}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border-t pt-4">
              <div><p className="text-muted-foreground">New price</p><p className="font-semibold">{formatPaise(discountResult.simulated.discountedPricePaise)}</p></div>
              <div>
                <p className="text-muted-foreground">New margin / unit</p>
                <p className={`font-semibold ${discountResult.simulated.unitMarginPaise <= 0 ? "text-red-600" : ""}`}>
                  {formatPaise(discountResult.simulated.unitMarginPaise)}
                  {discountResult.simulated.marginChangePct !== null && (
                    <span className="text-muted-foreground font-normal"> ({discountResult.simulated.marginChangePct}%)</span>
                  )}
                </p>
              </div>
              {discountResult.breakEven && (
                <div>
                  <p className="text-muted-foreground">Break-even</p>
                  <p className="font-semibold text-indigo-600">
                    {discountResult.breakEven.unitsRequired} units (+{discountResult.breakEven.upliftRequiredPct}% volume)
                  </p>
                </div>
              )}
            </div>

            {discountResult.scenarios && (
              <div className="overflow-x-auto border-t pt-4">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-2">If sales grow…</th>
                      <th className="px-4 py-2">Units sold</th>
                      <th className="px-4 py-2">Profit</th>
                      <th className="px-4 py-2">vs today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountResult.scenarios.map((s) => (
                      <tr key={s.upliftPct} className="border-b last:border-0">
                        <td className="px-4 py-2">+{s.upliftPct}%</td>
                        <td className="px-4 py-2">{s.unitsSold}</td>
                        <td className="px-4 py-2">{formatPaise(s.profitPaise)}</td>
                        <td className={`px-4 py-2 font-medium ${s.profitChangePct !== null && s.profitChangePct < 0 ? "text-red-600" : "text-green-600"}`}>
                          {s.profitChangePct !== null ? `${s.profitChangePct > 0 ? "+" : ""}${s.profitChangePct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {discountResult.projection && (
              <p className="text-sm border-t pt-4">
                <span className="font-semibold">Your estimate (+{discountResult.projection.upliftPct}%):</span>{" "}
                {formatPaise(discountResult.projection.profitPaise)} profit{" "}
                {discountResult.projection.profitChangePct !== null && (
                  <span className={discountResult.projection.profitChangePct < 0 ? "text-red-600" : "text-green-600"}>
                    ({discountResult.projection.profitChangePct > 0 ? "+" : ""}{discountResult.projection.profitChangePct}% vs today)
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {bogoResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              BOGO result — {bogoResult.product.name}{" "}
              {!bogoResult.hadRecentSales && <Badge variant="destructive">Dead stock</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {warningBanner(bogoResult.warnings)}
            {baselineCard(bogoResult.baseline)}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border-t pt-4">
              <div><p className="text-muted-foreground">Bundle (buy {bogoResult.bundle.buyQuantity} + {bogoResult.bundle.freeQuantity} free)</p><p className="font-semibold">{formatPaise(bogoResult.bundle.bundleRevenuePaise)} revenue</p></div>
              <div><p className="text-muted-foreground">Bundle cost</p><p className="font-semibold">{formatPaise(bogoResult.bundle.bundleCostPaise)}</p></div>
              <div>
                <p className="text-muted-foreground">Profit / bundle</p>
                <p className={`font-semibold ${bogoResult.bundle.bundleProfitPaise <= 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatPaise(bogoResult.bundle.bundleProfitPaise)}
                </p>
              </div>
              <div><p className="text-muted-foreground">Effective discount</p><p className="font-semibold">{bogoResult.bundle.effectiveDiscountPct}%</p></div>
              <div>
                <p className="text-muted-foreground">Margin / unit moved</p>
                <p className={`font-semibold ${bogoResult.bundle.marginPerUnitMovedPaise <= 0 ? "text-red-600" : ""}`}>
                  {formatPaise(bogoResult.bundle.marginPerUnitMovedPaise)}
                </p>
              </div>
              {bogoResult.breakEven && (
                <div>
                  <p className="text-muted-foreground">Break-even</p>
                  <p className="font-semibold text-indigo-600">
                    {bogoResult.breakEven.bundlesRequired} bundles ({bogoResult.breakEven.unitsMoved} units, +{bogoResult.breakEven.upliftRequiredPct}%)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
