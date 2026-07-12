"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { AdvisorClient, Recommendation, RecommendationSeverity } from "@/lib/api-client/advisor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, IndianRupee, TrendingUp, Package, AlertCircle, Lightbulb } from "lucide-react";

const SEVERITY_STYLES: Record<RecommendationSeverity, { badge: string; label: string }> = {
  HIGH: { badge: "bg-red-100 text-red-700 border-red-200", label: "Act now" },
  MEDIUM: { badge: "bg-amber-100 text-amber-700 border-amber-200", label: "At risk" },
  INFO: { badge: "bg-blue-100 text-blue-700 border-blue-200", label: "Review" },
};

export default function DashboardPage() {
  const { user, activeStore } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [advisorLoaded, setAdvisorLoaded] = useState(false);

  useEffect(() => {
    if (!activeStore?.id) return;
    setAdvisorLoaded(false);
    // Best-effort: cashiers lack the Owner/Manager role — hide the card silently.
    AdvisorClient.getRecommendations()
      .then((res) => {
        setRecommendations(res?.recommendations ?? []);
        setAdvisorLoaded(true);
      })
      .catch(() => {
        setRecommendations([]);
        setAdvisorLoaded(false);
      });
  }, [activeStore?.id]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name?.split(" ")[0] || "User"}!</h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at {activeStore?.name || "your store"} today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Package className="h-4 w-4" />
            Add Product
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Sale
          </Button>
        </div>
      </div>

      {advisorLoaded && (
        <Card className="border-indigo-100">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5 text-indigo-600" />
              Advisor
              {recommendations.length > 0 && (
                <Badge variant="outline">{recommendations.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All clear — no urgent actions detected. Bestsellers are stocked, nothing is
                expiring, and inventory is reconciled.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <div
                    key={`${rec.code}-${rec.productId ?? i}`}
                    className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border rounded-lg p-3"
                  >
                    <span
                      className={`text-xs font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap self-start md:self-center ${SEVERITY_STYLES[rec.severity].badge}`}
                    >
                      {SEVERITY_STYLES[rec.severity].label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.detail}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="whitespace-nowrap self-start md:self-center"
                      onClick={() => (window.location.href = rec.action.href)}
                    >
                      {rec.action.label}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹0.00</div>
            <p className="text-xs text-muted-foreground">
              +0% from yesterday
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Count</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+0</div>
            <p className="text-xs text-muted-foreground">
              0 items sold today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Items need restocking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Active in inventory
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ReceiptText className="h-10 w-10 mb-4 opacity-20" />
            <p>No sales recorded yet.</p>
            <Button variant="link" className="mt-2 text-primary">Record your first sale</Button>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Package className="h-10 w-10 mb-4 opacity-20" />
            <p>Add products to see insights.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Temporary icon fallback until imported
function ReceiptText(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M14 8H8" />
      <path d="M16 12H8" />
      <path d="M13 16H8" />
    </svg>
  );
}
