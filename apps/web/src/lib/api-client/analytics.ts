import { apiClient } from './client';

export interface AnalyticsSummary {
  revenue: number;
  profit: number;
  totalOrders: number;
}

export interface AnalyticsRevenuePoint {
  date: string;
  revenue: number;
  profit: number;
}

export interface AnalyticsTopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface AnalyticsDeadStock {
  productId: string;
  productName: string;
  stockQuantity: number;
  lockedValue: number;
}

export interface AnalyticsInventoryHealth {
  lowStockCount: number;
  thresholdUsed: number;
  reconciliationCount?: number;
  expiredCount?: number;
  expiringSoonCount?: number;
  expiryWindowDays?: number;
}

export interface ChatResponse {
  response: string;
}

export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

export interface AiStatusResponse {
  isConfigured: boolean;
}

export const analyticsApi = {
  getSummary: (storeId: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<AnalyticsSummary>(`/analytics/summary`, {
      headers: { 'x-store-id': storeId },
      params,
    }),

  getRevenueChart: (storeId: string, params?: { startDate?: string; endDate?: string; productId?: string }) =>
    apiClient.get<AnalyticsRevenuePoint[]>(`/analytics/revenue`, {
      headers: { 'x-store-id': storeId },
      params,
    }),

  getTopProducts: (storeId: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<AnalyticsTopProduct[]>(`/analytics/top-products`, {
      headers: { 'x-store-id': storeId },
      params,
    }),

  getDeadStock: (storeId: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<AnalyticsDeadStock[]>(`/analytics/dead-stock`, {
      headers: { 'x-store-id': storeId },
      params,
    }),

  getInventoryHealth: (storeId: string) =>
    apiClient.get<AnalyticsInventoryHealth>(`/analytics/inventory-health`, {
      headers: { 'x-store-id': storeId },
    }),

  chatWithAi: (storeId: string, message: string, history?: ChatTurn[]) =>
    apiClient.post<ChatResponse>(
      `/analytics/chat`,
      { message, ...(history && history.length > 0 ? { history } : {}) },
      { headers: { 'x-store-id': storeId } }
    ),

  getAiStatus: (storeId: string) =>
    apiClient.get<AiStatusResponse>(`/analytics/ai-status`, {
      headers: { 'x-store-id': storeId },
    }),
};
