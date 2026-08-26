// Manual mock for the ESM-only `@openrouter/sdk` package.
// The real package ships as ESM which ts-jest/CommonJS cannot parse in unit
// tests, so we replace it with a lightweight stub. Only the shape used by
// EmbeddingsService (`new OpenRouter().embeddings.generate(...)`) is stubbed.
export class OpenRouter {
  embeddings = {
    generate: jest.fn().mockResolvedValue({ data: [{ embedding: [] }] }),
  };
}
