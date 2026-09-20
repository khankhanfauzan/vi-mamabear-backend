import { Injectable, BadGatewayException } from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';

export interface OpenRouterChatResult {
  content: string;
  tokensUsed: number;
  model: string;
}

/** HTTP status codes that warrant a retry on the fallback model. */
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503]);

@Injectable()
export class OpenRouterClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fallbackModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly logger: PinoLogger) {
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = process.env.OPENROUTER_MODEL || 'poolside/laguna-xs-2.1:free';
    this.fallbackModel =
      process.env.OPENROUTER_FALLBACK_MODEL || 'liquid/lfm-2.5-2.6b:free';
    this.timeoutMs = parseInt(process.env.OPENROUTER_TIMEOUT_MS || '13000', 10);
    this.logger.setContext(OpenRouterClient.name);
  }

  async chat(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<OpenRouterChatResult> {
    // ── Attempt primary model ──────────────────────────────────────────
    try {
      return await this.fetchModel(this.model, messages);
    } catch (primaryError) {
      // Non-retryable errors (e.g. 401, 403) should surface immediately
      if (!this.isRetryable(primaryError)) {
        throw primaryError;
      }

      const reason = this.describeError(primaryError);

      this.logger.warn(
        {
          primaryModel: this.model,
          fallbackModel: this.fallbackModel,
          reason,
          primaryErrorMessage: (primaryError as Error).message,
        },
        `Primary model failed (${reason}), attempting fallback model`,
      );

      // ── Attempt fallback model ─────────────────────────────────────
      try {
        return await this.fetchModel(this.fallbackModel, messages);
      } catch (fallbackError) {
        this.logger.error(
          {
            primaryModel: this.model,
            fallbackModel: this.fallbackModel,
            primaryReason: reason,
            fallbackReason: this.describeError(fallbackError),
            fallbackErrorMessage: (fallbackError as Error).message,
          },
          'Both primary and fallback models failed',
        );

        throw new BadGatewayException(
          'AI sedang sibuk, coba lagi sebentar lagi.',
        );
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Execute a single chat-completion request against a specific model,
   * enforcing a timeout via AbortController.
   */
  private async fetchModel(
    model: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<OpenRouterChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        const msg =
          errorBody?.error?.message ||
          `OpenRouter API error (HTTP ${response.status})`;

        const err = new BadGatewayException(msg);
        // Attach the HTTP status so the retry logic can inspect it
        (err as any).httpStatus = response.status;
        throw err;
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
        model?: string;
      };

      const content: string = String(data.choices?.[0]?.message?.content ?? '');
      const tokensUsed: number = data.usage?.total_tokens ?? 0;
      const resolvedModel: string = data.model ?? model;

      return { content, tokensUsed, model: resolvedModel };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Determine whether a caught error should trigger a fallback retry.
   * Only timeouts, rate-limits (429), and server errors (502/503) qualify.
   */
  private isRetryable(error: unknown): boolean {
    // AbortError = timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }
    // Node 20+ may throw a plain Error with name 'AbortError'
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }
    // HTTP status-based errors (attached by fetchModel)
    const httpStatus = (error as any)?.httpStatus;
    if (
      typeof httpStatus === 'number' &&
      RETRYABLE_STATUS_CODES.has(httpStatus)
    ) {
      return true;
    }
    // Network failures (fetch rejected entirely)
    if (
      error instanceof Error &&
      !(error instanceof BadGatewayException) &&
      !('httpStatus' in (error as any))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Human-readable reason for the failure (used in audit logs).
   */
  private describeError(error: unknown): string {
    if (
      (error instanceof DOMException || error instanceof Error) &&
      error.name === 'AbortError'
    ) {
      return 'timeout';
    }
    const httpStatus = (error as any)?.httpStatus;
    if (typeof httpStatus === 'number') {
      return `HTTP ${httpStatus}`;
    }
    return 'network_error';
  }
}
