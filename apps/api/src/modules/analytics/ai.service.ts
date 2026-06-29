import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI?: GoogleGenerativeAI;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY is not set. AI Advisor will return mocked responses.');
    }
  }

  isAiConfigured(): boolean {
    return !!this.genAI;
  }

  async generateChatResponse(storeId: string, message: string): Promise<string> {
    // Gather analytics data to act as secure context
    const [summary, deadStock, topProducts] = await Promise.all([
      this.analyticsService.getSummary(storeId),
      this.analyticsService.getDeadStock(storeId),
      this.analyticsService.getTopProducts(storeId),
    ]);

    const storeContext = {
      summary,
      topProducts,
      deadStock,
    };

    const systemInstruction = `
You are an expert retail advisor for a small business. You must answer the user's question based ONLY on their store's analytics data provided below.
Do not hallucinate. If the data does not contain the answer, say you don't know. Keep responses concise, friendly, and actionable.

STORE ANALYTICS DATA (LAST 30 DAYS):
${JSON.stringify(storeContext, null, 2)}
    `;

    if (!this.genAI) {
      throw new HttpException('AI_NOT_CONFIGURED', HttpStatus.NOT_IMPLEMENTED);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        systemInstruction,
      });

      const result = await model.generateContent(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Failed to generate AI response', error);
      throw new HttpException('Failed to generate AI response', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
