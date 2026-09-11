import { Injectable, Logger, BadGatewayException } from '@nestjs/common';

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.model = process.env.OPENROUTER_MODEL || 'poolside/laguna-xs-2.1:free';
  }

  async chat(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<string> {
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
        const error = await response.json();
        throw new BadGatewayException(
          error?.error?.message || 'OpenRouter API error',
        );
      }

      const data = await response.json();
      const content: string = String(data.choices?.[0]?.message?.content ?? '');
      return content;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.error(`OpenRouter chat error: ${(error as Error).message}`);
      throw new BadGatewayException('AI sedang tidak tersedia');
    }
  }
}
