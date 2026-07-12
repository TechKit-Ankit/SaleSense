import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AdvisorService } from '../advisor/advisor.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { ChatTurnDto } from './dto/chat.dto';

/** Only the freshest turns are forwarded; the system prompt carries fresh data anyway. */
const MAX_HISTORY_TURNS = 8;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI?: GoogleGenerativeAI;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly advisorService: AdvisorService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY is not set. AI Advisor is disabled.');
    }
  }

  isAiConfigured(): boolean {
    return !!this.genAI;
  }

  /**
   * Assembles the grounded store context (design doc 0008): raw analytics
   * plus the deterministic advisor findings the dashboard shows. Advisor
   * failure degrades gracefully — the chat must not die because one data
   * source failed.
   */
  async buildContext(storeId: string) {
    const [summary, deadStock, topProducts, inventoryHealth, advisor] = await Promise.all([
      this.analyticsService.getSummary(storeId),
      this.analyticsService.getDeadStock(storeId),
      this.analyticsService.getTopProducts(storeId),
      this.analyticsService.getInventoryHealth(storeId),
      this.advisorService.getRecommendations(storeId).catch((e: any) => {
        this.logger.warn(`Advisor context unavailable for chat: ${e?.message}`);
        return { recommendations: [] };
      }),
    ]);

    return {
      summary,
      topProducts,
      deadStock,
      inventoryHealth,
      recommendations: advisor.recommendations,
    };
  }

  /** Grounding rules + serialized context. Rebuilt fresh on every request. */
  buildSystemInstruction(context: unknown): string {
    return `
You are an expert retail advisor for a small business. Answer the user's question based ONLY on their store's data provided below.
Rules:
1. Do not hallucinate. If the data does not contain the answer, say you don't know.
2. The RECOMMENDATIONS block contains deterministic findings already verified by the system. When a question touches one, cite it plainly (product name + the concrete number) and treat it as ground truth.
3. When advising a discount or BOGO offer, direct the user to the Promotions page of this app to simulate it first — never invent your own profitability math.
4. For pending stock reconciliation point to the Inventory > Reconciliation page; for reordering point to the Purchases page; for expired stock point to the Inventory page.
5. Keep responses concise, friendly, and actionable. Amounts are in Indian rupees; *Paise fields are hundredths of a rupee.

STORE DATA (LAST 30 DAYS):
${JSON.stringify(context, null, 2)}
    `;
  }

  /** Keeps the freshest turns and maps them to Gemini's content format. */
  mapHistory(history?: ChatTurnDto[]) {
    return (history ?? [])
      .slice(-MAX_HISTORY_TURNS)
      .map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] }));
  }

  async generateChatResponse(storeId: string, message: string, history?: ChatTurnDto[]): Promise<string> {
    if (!this.genAI) {
      throw new HttpException('AI_NOT_CONFIGURED', HttpStatus.NOT_IMPLEMENTED);
    }

    const context = await this.buildContext(storeId);
    const systemInstruction = this.buildSystemInstruction(context);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        systemInstruction,
      });

      const chat = model.startChat({ history: this.mapHistory(history) });
      const result = await chat.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Failed to generate AI response', error);
      throw new HttpException('Failed to generate AI response', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
