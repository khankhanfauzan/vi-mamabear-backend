import { Injectable, Logger, BadGatewayException } from '@nestjs/common';

export interface OpenRouterChatResult {
  content: string;
  tokensUsed: number;
  model: string;
}

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = process.env.OPENROUTER_MODEL || 'poolside/laguna-xs-2.1:free';
  }

  async chat(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<OpenRouterChatResult> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as {
          error?: { message?: string };
        };
        throw new BadGatewayException(
          error?.error?.message || 'OpenRouter API error',
        );
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
        model?: string;
      };
      const content: string = String(data.choices?.[0]?.message?.content ?? '');
      const tokensUsed: number = data.usage?.total_tokens ?? 0;
      const model: string = data.model ?? this.model;

      return { content, tokensUsed, model };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.error(`OpenRouter chat error: ${(error as Error).message}`);
      throw new BadGatewayException(
        'AI sedang tidak tersedia. Silakan coba lagi nanti.',
      );
    }
  }
}
