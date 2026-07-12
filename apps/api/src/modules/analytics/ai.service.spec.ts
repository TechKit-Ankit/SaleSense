import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AnalyticsService } from './analytics.service';
import { AdvisorService } from '../advisor/advisor.service';

const mockAnalyticsService = {
  getSummary: jest.fn(),
  getDeadStock: jest.fn(),
  getTopProducts: jest.fn(),
  getInventoryHealth: jest.fn(),
};

const mockAdvisorService = {
  getRecommendations: jest.fn(),
};

const buildService = async (apiKey: string | undefined): Promise<AiService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AiService,
      { provide: AnalyticsService, useValue: mockAnalyticsService },
      { provide: AdvisorService, useValue: mockAdvisorService },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(apiKey) } },
    ],
  }).compile();
  return module.get<AiService>(AiService);
};

describe('AiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsService.getSummary.mockResolvedValue({ revenue: 1000, profit: 200, totalOrders: 5 });
    mockAnalyticsService.getDeadStock.mockResolvedValue([{ productId: 'p1', productName: 'Coat', lockedValue: 440 }]);
    mockAnalyticsService.getTopProducts.mockResolvedValue([{ productId: 'p2', productName: 'Milk', revenue: 360 }]);
    mockAnalyticsService.getInventoryHealth.mockResolvedValue({ lowStockCount: 1, reconciliationCount: 2 });
    mockAdvisorService.getRecommendations.mockResolvedValue({
      recommendations: [{ code: 'DEAD_STOCK', severity: 'MEDIUM', title: 'Coat: locked capital' }],
    });
  });

  it('reports configured only when the API key is present', async () => {
    expect((await buildService('key-123')).isAiConfigured()).toBe(true);
    expect((await buildService(undefined)).isAiConfigured()).toBe(false);
  });

  it('throws AI_NOT_CONFIGURED (501) when no key is set', async () => {
    const service = await buildService(undefined);
    await expect(service.generateChatResponse('store_1', 'hello')).rejects.toMatchObject({
      message: 'AI_NOT_CONFIGURED',
      status: 501,
    });
    expect(service.generateChatResponse('store_1', 'hello')).rejects.toBeInstanceOf(HttpException);
  });

  describe('buildContext', () => {
    it('assembles all five context blocks including advisor findings', async () => {
      const service = await buildService('key-123');

      const context = await service.buildContext('store_1');

      expect(context).toEqual({
        summary: { revenue: 1000, profit: 200, totalOrders: 5 },
        topProducts: [{ productId: 'p2', productName: 'Milk', revenue: 360 }],
        deadStock: [{ productId: 'p1', productName: 'Coat', lockedValue: 440 }],
        inventoryHealth: { lowStockCount: 1, reconciliationCount: 2 },
        recommendations: [{ code: 'DEAD_STOCK', severity: 'MEDIUM', title: 'Coat: locked capital' }],
      });
    });

    it('degrades gracefully when the advisor fails — chat context still builds', async () => {
      mockAdvisorService.getRecommendations.mockRejectedValue(new Error('advisor down'));
      const service = await buildService('key-123');

      const context = await service.buildContext('store_1');

      expect(context.recommendations).toEqual([]);
      expect(context.summary.revenue).toBe(1000);
    });
  });

  describe('buildSystemInstruction', () => {
    it('contains the grounding rules and the serialized context', async () => {
      const service = await buildService('key-123');
      const instruction = service.buildSystemInstruction({ summary: { revenue: 1000 } });

      expect(instruction).toContain('Do not hallucinate');
      expect(instruction).toContain('Promotions page');
      expect(instruction).toContain('never invent your own profitability math');
      expect(instruction).toContain('"revenue": 1000');
    });
  });

  describe('mapHistory', () => {
    it('keeps only the last 8 turns and maps to Gemini format', async () => {
      const service = await buildService('key-123');
      const history = Array.from({ length: 12 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'model') as 'user' | 'model',
        content: `turn ${i}`,
      }));

      const mapped = service.mapHistory(history);

      expect(mapped).toHaveLength(8);
      expect(mapped[0]).toEqual({ role: 'user', parts: [{ text: 'turn 4' }] });
      expect(mapped[7]).toEqual({ role: 'model', parts: [{ text: 'turn 11' }] });
    });

    it('accepts absent history', async () => {
      const service = await buildService('key-123');
      expect(service.mapHistory(undefined)).toEqual([]);
    });
  });
});
