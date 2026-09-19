import { Test, TestingModule } from '@nestjs/testing';
import { OpenRouterClient } from './openrouter.client';
import { BadGatewayException } from '@nestjs/common';

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    // Configure env for deterministic tests
    process.env.OPENROUTER_MODEL = 'primary/test-model';
    process.env.OPENROUTER_FALLBACK_MODEL = 'fallback/test-model';
    process.env.OPENROUTER_TIMEOUT_MS = '5000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenRouterClient],
    }).compile();

    client = module.get<OpenRouterClient>(OpenRouterClient);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_FALLBACK_MODEL;
    delete process.env.OPENROUTER_TIMEOUT_MS;
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  // ── Happy path ───────────────────────────────────────────────────────

  it('should successfully make chat request and return content (no fallback)', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Mocked response content' } }],
      usage: { total_tokens: 15 },
      model: 'primary/test-model',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await client.chat([{ role: 'user', content: 'Hello' }]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      content: 'Mocked response content',
      tokensUsed: 15,
      model: 'primary/test-model',
    });
  });

  // ── Fallback scenarios ───────────────────────────────────────────────

  describe('fallback on retryable errors', () => {
    const fallbackResponse = {
      choices: [{ message: { content: 'Fallback response' } }],
      usage: { total_tokens: 10 },
      model: 'fallback/test-model',
    };

    it('should fallback when primary returns HTTP 429 (rate limit)', async () => {
      global.fetch = jest
        .fn()
        // Primary: 429
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: jest
            .fn()
            .mockResolvedValue({ error: { message: 'Rate limited' } }),
        })
        // Fallback: success
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(fallbackResponse),
        });

      const result = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.model).toBe('fallback/test-model');
      expect(result.content).toBe('Fallback response');
    });

    it('should fallback when primary returns HTTP 502 (bad gateway)', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: jest
            .fn()
            .mockResolvedValue({ error: { message: 'Bad Gateway' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(fallbackResponse),
        });

      const result = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.model).toBe('fallback/test-model');
    });

    it('should fallback when primary times out (AbortError)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(fallbackResponse),
        });

      const result = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.model).toBe('fallback/test-model');
      expect(result.content).toBe('Fallback response');
    });

    it('should fallback when primary has a network failure', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(fallbackResponse),
        });

      const result = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.model).toBe('fallback/test-model');
    });
  });

  // ── Both models fail ─────────────────────────────────────────────────

  describe('both models fail', () => {
    it('should throw BadGatewayException with user-friendly message when both fail', async () => {
      global.fetch = jest
        .fn()
        // Primary: 502
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: jest
            .fn()
            .mockResolvedValue({ error: { message: 'Primary down' } }),
        })
        // Fallback: 502
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: jest
            .fn()
            .mockResolvedValue({ error: { message: 'Fallback down' } }),
        });

      await expect(
        client.chat([{ role: 'user', content: 'Hello' }]),
      ).rejects.toThrow(BadGatewayException);

      try {
        // Reset mock for second call
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 502,
            json: jest
              .fn()
              .mockResolvedValue({ error: { message: 'Primary down' } }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 502,
            json: jest
              .fn()
              .mockResolvedValue({ error: { message: 'Fallback down' } }),
          });

        await client.chat([{ role: 'user', content: 'Hello' }]);
      } catch (e: any) {
        expect(e.message).toBe('AI sedang sibuk, coba lagi sebentar lagi.');
      }
    });

    it('should throw BadGatewayException when both timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError);

      await expect(
        client.chat([{ role: 'user', content: 'Hello' }]),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  // ── Non-retryable errors ─────────────────────────────────────────────

  describe('non-retryable errors', () => {
    it('should NOT fallback on HTTP 401 (auth error) — throw immediately', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: jest
          .fn()
          .mockResolvedValue({ error: { message: 'Invalid API Key' } }),
      });

      await expect(
        client.chat([{ role: 'user', content: 'Hello' }]),
      ).rejects.toThrow(BadGatewayException);

      // fetch should only be called ONCE — no fallback attempt
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT fallback on HTTP 403 (forbidden)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({ error: { message: 'Forbidden' } }),
      });

      await expect(
        client.chat([{ role: 'user', content: 'Hello' }]),
      ).rejects.toThrow(BadGatewayException);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ── Timeout signal is attached ───────────────────────────────────────

  it('should pass AbortSignal to fetch', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'OK' } }],
      usage: { total_tokens: 5 },
      model: 'primary/test-model',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    await client.chat([{ role: 'user', content: 'Hello' }]);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const fetchOptions = fetchCall[1];
    expect(fetchOptions.signal).toBeDefined();
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });

  // ── Correct model sent in request body ───────────────────────────────

  it('should send primary model name in request body', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'OK' } }],
      usage: { total_tokens: 5 },
      model: 'primary/test-model',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    await client.chat([{ role: 'user', content: 'Hello' }]);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toBe('primary/test-model');
  });

  it('should send fallback model name when primary fails', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const fallbackResponse = {
      choices: [{ message: { content: 'Fallback' } }],
      usage: { total_tokens: 5 },
      model: 'fallback/test-model',
    };

    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(fallbackResponse),
      });

    await client.chat([{ role: 'user', content: 'Hello' }]);

    const secondCall = (global.fetch as jest.Mock).mock.calls[1];
    const body = JSON.parse(secondCall[1].body);
    expect(body.model).toBe('fallback/test-model');
  });
});
