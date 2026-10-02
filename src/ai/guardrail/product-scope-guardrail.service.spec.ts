import { ProductScopeGuardrailService } from './product-scope-guardrail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingsService } from '@/embeddings/embeddings.service';
import { extractProductQueries } from './product-scope';

describe('ProductScopeGuardrailService', () => {
  const catalog = [
    { id: 1, name: 'MamaBear AlmonMix Isi 6 Sachet', tags: [] },
    { id: 3, name: 'MamaBear Teh Pelancar ASI Isi 20 Sachet', tags: [] },
    { id: 5, name: 'MamaBear ASI Booster 30 Kapsul', tags: [] },
  ];
  const prisma = { product: { findMany: jest.fn() }, $queryRaw: jest.fn() };
  const embeddings = {
    generateEmbeddingFromString: jest.fn(),
    embeddingArrayToString: jest.fn(),
  };
  let service: ProductScopeGuardrailService;
  const originalThreshold = process.env.PRODUCT_MATCH_THRESHOLD;

  beforeEach(() => {
    delete process.env.PRODUCT_MATCH_THRESHOLD;
    jest.resetAllMocks();
    prisma.product.findMany.mockResolvedValue(catalog);
    embeddings.generateEmbeddingFromString.mockResolvedValue(
      Array(1024).fill(0.1),
    );
    embeddings.embeddingArrayToString.mockReturnValue('[0.1]');
    prisma.$queryRaw.mockResolvedValue([{ ...catalog[2], similarity: 0.6 }]);
    service = new ProductScopeGuardrailService(
      prisma as unknown as PrismaService,
      embeddings as unknown as EmbeddingsService,
    );
  });
  afterAll(() => {
    if (originalThreshold === undefined)
      delete process.env.PRODUCT_MATCH_THRESHOLD;
    else process.env.PRODUCT_MATCH_THRESHOLD = originalThreshold;
  });

  it.each([
    'Jual kantong ASI ga Min?',
    'Ada produk kantong ASI ga?',
    'Ready kantong ASI min?',
    'Ada rekomendasi breast pump merk X?',
    'Ada breast pump merk X ga?',
    'Jual stroller galaksi ga?',
  ])('discards hallucinated draft for %s', async (query) => {
    const draft = 'Ya Ma, produk itu tersedia! [PRODUCT_IDS: 5]';
    const result = await service.validateProductQuery(query, draft);
    expect(result.blocked).toBe(true);
    expect(result.response).not.toBe(draft);
    expect(result.response).not.toContain('[PRODUCT_IDS:');
    expect(result.response).toMatch(/Ma|Mama/);
    expect(result.response).toMatch(/bantu/);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
  it.each([
    'Ada AlmonMix ga?',
    'Apakah kalian menjual AlmonMix?',
    'Jual teh pelancar ASI ga Min?',
    'MamaBear ASI Booster 30 Kapsul ada stoknya ga?',
  ])('allows an actual seed catalog name: %s', async (query) => {
    expect(await service.validateProductQuery(query, 'Jawaban normal')).toEqual(
      { blocked: false, response: 'Jawaban normal' },
    );
  });
  it.each([
    'Bagaimana cara menggunakan kantong ASI?',
    'Ada cara meningkatkan produksi ASI?',
    'Apa penyebab ASI tidak ada?',
    'Kenapa ASI saya sedikit?',
    'Ada produk apa aja min?',
    'Mau beli sesuatu buat bayi baru lahir',
    'Ada rekomendasi produk untuk MPASI?',
  ])('preserves education and broad requests: %s', async (query) => {
    expect(await service.check(query)).toBeNull();
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
  it('uses a parameterized pgvector search against active embedded products', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ...catalog[2], similarity: 0.75 }]);
    expect(await service.check('Jual kapsul ASI Booster?')).toBeNull();
    const [parts, vector] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(parts.join('?')).toContain('embedding <=> ?::vector');
    expect(parts.join('?')).toContain(
      '"isActive" = true AND embedding IS NOT NULL',
    );
    expect(vector).toBe('[0.1]');
    expect(embeddings.generateEmbeddingFromString).toHaveBeenCalledWith(
      'kapsul asi booster',
    );
  });
  it('blocks immediately below the threshold', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ...catalog[2], similarity: 0.7499 }]);
    expect(await service.check('Jual kapsul ASI Booster?')).toMatchObject({
      blockReason: 'PRODUCT_OUT_OF_SCOPE',
    });
  });
  it('does not let high semantic similarity erase a wrong type or brand', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 9,
        name: 'Pompa ASI elektrik MamaBear',
        tags: [],
        similarity: 0.99,
      },
    ]);
    expect(await service.check('Ada breast pump merk X?')).toMatchObject({
      blockReason: 'PRODUCT_OUT_OF_SCOPE',
    });
    expect(await service.check('Jual kantong ASI?')).toMatchObject({
      blockReason: 'PRODUCT_OUT_OF_SCOPE',
    });
  });
  it('checks all requested products, not just the valid one', async () => {
    expect(await service.check('Jual AlmonMix dan kantong ASI?')).toMatchObject(
      { blockReason: 'PRODUCT_OUT_OF_SCOPE' },
    );
  });
  it('does not erase a requested pack size when grounding identity', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ...catalog[2], similarity: 0.99 }]);
    expect(await service.check('Jual ASI Booster 999 Kapsul?')).toMatchObject({
      blockReason: 'PRODUCT_OUT_OF_SCOPE',
    });
  });
  it('allows a verified literal product without relying on embeddings', async () => {
    embeddings.generateEmbeddingFromString.mockRejectedValue(
      new Error('offline'),
    );
    expect(await service.check('Jual AlmonMix?')).toBeNull();
  });
  it('blocks an empty catalog or vector result', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await service.check('Jual AlmonMix?')).toMatchObject({
      blockReason: 'PRODUCT_OUT_OF_SCOPE',
    });
  });
  it.each(['embedding', 'database', 'invalid vector'])(
    'fails safely when verification fails: %s',
    async (failure) => {
      if (failure === 'embedding')
        embeddings.generateEmbeddingFromString.mockRejectedValue(
          new Error('offline'),
        );
      if (failure === 'database')
        prisma.product.findMany.mockRejectedValue(new Error('offline'));
      if (failure === 'invalid vector')
        embeddings.generateEmbeddingFromString.mockResolvedValue([NaN]);
      const result = await service.check('Jual kantong ASI?');
      expect(result).toMatchObject({
        blockReason: 'PRODUCT_CATALOG_UNAVAILABLE',
      });
      expect(result?.responseMessage).not.toContain('tidak dijual');
    },
  );
  it('honors a calibrated configuration', async () => {
    process.env.PRODUCT_MATCH_THRESHOLD = '0.85';
    service = new ProductScopeGuardrailService(
      prisma as unknown as PrismaService,
      embeddings as unknown as EmbeddingsService,
    );
    prisma.$queryRaw.mockResolvedValue([{ ...catalog[2], similarity: 0.8 }]);
    expect(await service.check('Jual kapsul ASI Booster?')).not.toBeNull();
  });
  it.each(['', 'NaN', '-0.1', '1.1'])(
    'rejects an invalid threshold: %s',
    (value) => {
      process.env.PRODUCT_MATCH_THRESHOLD = value;
      expect(
        () =>
          new ProductScopeGuardrailService(
            prisma as unknown as PrismaService,
            embeddings as unknown as EmbeddingsService,
          ),
      ).toThrow('PRODUCT_MATCH_THRESHOLD');
    },
  );
  it('extracts product identity regardless of availability wording position', () => {
    expect(
      extractProductQueries('MamaBear ASI Booster 30 Kapsul ada stoknya ga?'),
    ).toEqual(['mamabear asi booster 30 kapsul']);
  });

  describe('VIMB-98: Health education false-positive fix (Bug #4)', () => {
    it('should NOT extract product query from "min kalau ada pendaraah di trimester 3 itu normal apa ngga?"', () => {
      const result = extractProductQueries(
        'min kalau ada pendaraah di trimester 3 itu normal apa ngga?',
      );
      expect(result).toEqual([]);
    });

    it('should NOT extract product query from "ada pendarahan di trimester 3 normal ga?"', () => {
      const result = extractProductQueries(
        'ada pendarahan di trimester 3 normal ga?',
      );
      expect(result).toEqual([]);
    });

    it('should NOT extract product query from "kak kalau ada kontraksi di bulan 7 bahaya ga?"', () => {
      const result = extractProductQueries(
        'kak kalau ada kontraksi di bulan 7 bahaya ga?',
      );
      expect(result).toEqual([]);
    });

    it('should STILL extract product query from "ada produk pompa ASI elektrik?"', () => {
      const result = extractProductQueries('ada produk pompa ASI elektrik?');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
