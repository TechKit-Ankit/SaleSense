import { apiClient } from './client';

export type RecommendationSeverity = 'HIGH' | 'MEDIUM' | 'INFO';

export interface Recommendation {
  code: string;
  severity: RecommendationSeverity;
  title: string;
  detail: string;
  productId?: string;
  metrics: Record<string, number | string | null>;
  action: { label: string; href: string };
}

export interface RecommendationsResult {
  generatedAt: string;
  periodDays: number;
  recommendations: Recommendation[];
}

export const AdvisorClient = {
  getRecommendations: (periodDays?: number): Promise<RecommendationsResult> =>
    apiClient.post('/advisor/recommendations', periodDays ? { periodDays } : {}),
};
