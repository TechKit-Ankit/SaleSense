"use client";

import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, Bot, Sparkles, Send, Loader2, PackageX, TrendingUp, DollarSign, ListOrdered, LockKeyhole } from "lucide-react";
import { analyticsApi, AnalyticsSummary, AnalyticsRevenuePoint, AnalyticsTopProduct, AnalyticsDeadStock, AnalyticsInventoryHealth } from "@/lib/api-client/analytics";
import { useAuth } from "@/lib/auth/auth-context";
import { formatCurrency } from "@/lib/utils/formatters";

export default function AnalyticsPage() {
  const { activeStore } = useAuth();
  
  // Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Data
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [revenueChart, setRevenueChart] = useState<AnalyticsRevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<AnalyticsTopProduct[]>([]);
  const [deadStock, setDeadStock] = useState<AnalyticsDeadStock[]>([]);
  const [health, setHealth] = useState<AnalyticsInventoryHealth | null>(null);

  // AI Chat
  const [isAiConfigured, setIsAiConfigured] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!activeStore) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const storeId = activeStore.id;
        const params = { startDate, endDate };
        
        const [sumRes, revRes, topRes, deadRes, healthRes, aiRes] = await Promise.all([
          analyticsApi.getSummary(storeId, params),
          analyticsApi.getRevenueChart(storeId, params),
          analyticsApi.getTopProducts(storeId, params),
          analyticsApi.getDeadStock(storeId, params),
          analyticsApi.getInventoryHealth(storeId),
          analyticsApi.getAiStatus(storeId).catch(() => ({ data: { isConfigured: false } }))
        ]);

        setSummary(sumRes.data);
        setRevenueChart(revRes.data);
        setTopProducts(topRes.data);
        setDeadStock(deadRes.data);
        setHealth(healthRes.data);
        setIsAiConfigured(aiRes.data.isConfigured);
      } catch (error) {
        console.error("Failed to load analytics", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeStore, startDate, endDate]);

  const handleExportCSV = () => {
    if (revenueChart.length === 0) return;
    
    const headers = "Date,Revenue,Profit\n";
    const csvContent = revenueChart.map(row => `${row.date},${row.revenue},${row.profit}`).join("\n");
    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `salesense_analytics_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !activeStore) return;

    const msg = chatMessage;
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    try {
      const res = await analyticsApi.chatWithAi(activeStore.id, msg);
      setChatHistory(prev => [...prev, { role: 'ai', content: res.data.response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I couldn't process that request right now." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!activeStore) return <div>Select a store</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & AI Insights</h1>
          <p className="text-gray-500 text-sm">Real-time performance for {activeStore.name}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
          <span className="text-gray-500">to</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 font-medium transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-indigo-600 w-8 h-8" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Gross Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.revenue || 0)}</h3>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600"><DollarSign size={24} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Net Profit</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.profit || 0)}</h3>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-green-600"><TrendingUp size={24} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Orders</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{summary?.totalOrders || 0}</h3>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-purple-600"><ListOrdered size={24} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Low Stock Items</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">{health?.lowStockCount || 0}</h3>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-red-600"><PackageX size={24} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Charts and Tables (Takes 2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Chart */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue & Profit Trends</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <RechartsTooltip 
                        formatter={(value: any) => formatCurrency(Number(value))}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      />
                      <Legend iconType="circle" />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Top Products</h3>
                  <div className="space-y-4">
                    {topProducts.map((p, i) => (
                      <div key={p.productId} className="flex justify-between items-center border-b pb-2 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-medium">#{i+1}</span>
                          <div>
                            <p className="font-medium text-gray-900">{p.productName}</p>
                            <p className="text-xs text-gray-500">{p.quantitySold} units sold</p>
                          </div>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                    {topProducts.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No sales in this period.</p>}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Dead Stock (0 Sales)</h3>
                  <div className="space-y-4">
                    {deadStock.map((p) => (
                      <div key={p.productId} className="flex justify-between items-center border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium text-gray-900">{p.productName}</p>
                          <p className="text-xs text-red-500">{p.stockQuantity} units idle</p>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCurrency(p.lockedValue)} locked</span>
                      </div>
                    ))}
                    {deadStock.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No dead stock detected.</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: AI Advisor */}
            <div className="bg-gradient-to-b from-indigo-50 to-white p-5 rounded-xl shadow-sm border border-indigo-100 flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
              <div className="flex items-center gap-2 mb-4 text-indigo-700">
                <Sparkles size={20} />
                <h3 className="text-lg font-bold">SaleSense AI Advisor</h3>
              </div>
              
              {!isAiConfigured ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border-2 border-dashed border-indigo-200 rounded-xl bg-white/50">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-500">
                    <LockKeyhole size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Unlock AI Insights</h4>
                  <p className="text-gray-500 text-sm mb-6">
                    Connect the Google Gemini API to enable your personal retail advisor. Ask questions, analyze trends, and get actionable business recommendations.
                  </p>
                  <div className="bg-indigo-50 text-indigo-800 text-xs py-2 px-4 rounded-lg inline-block border border-indigo-100">
                    Set <span className="font-mono font-bold">GEMINI_API_KEY</span> in your environment.
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                    {chatHistory.length === 0 ? (
                      <div className="text-center text-gray-500 py-10">
                        <Bot className="w-12 h-12 mx-auto text-indigo-300 mb-3" />
                        <p>Hi! I have access to your store's analytics.</p>
                        <p className="text-sm mt-2">Ask me things like:<br/>"Why is my profit low this week?"</p>
                      </div>
                    ) : (
                      chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-br-none' 
                              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 p-3 rounded-lg rounded-bl-none shadow-sm flex gap-1">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="mt-auto relative">
                    <input 
                      type="text" 
                      value={chatMessage}
                      onChange={e => setChatMessage(e.target.value)}
                      placeholder="Ask AI for insights..."
                      className="w-full bg-white border border-gray-300 rounded-full py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                      disabled={chatLoading}
                    />
                    <button 
                      type="submit" 
                      disabled={!chatMessage.trim() || chatLoading}
                      className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-full disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
