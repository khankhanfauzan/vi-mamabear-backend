import { Test, TestingModule } from '@nestjs/testing';
import { OpenRouterClient } from './openrouter.client';
import { BadGatewayException } from '@nestjs/common';

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenRouterClient],
    }).compile();

    client = module.get<OpenRouterClient>(OpenRouterClient);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  it('should successfully make chat request and return content', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Mocked response content' } }],
      usage: { total_tokens: 15 },
      model: 'mock-model-name',
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
      model: 'mock-model-name',
    });
  });

  it('should handle API errors correctly (BadGatewayException)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: { message: 'Invalid API Key' },
      }),
    });

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(BadGatewayException);

    try {
      await client.chat([{ role: 'user', content: 'Hello' }]);
    } catch (e: any) {
      expect(e.message).toBe('Invalid API Key');
    }
  });

  it('should handle network/fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(BadGatewayException);
  });
});
