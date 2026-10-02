import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingsService } from '@/embeddings/embeddings.service';
import { BLOCK_REASONS } from './blocked-keywords';
import { GuardrailResult } from './guardrail.service';
import { pickHumanizedMessage } from './guardrail-messages';
import { extractProductQueries, matchesProductIdentity } from './product-scope';

// Provisional until the real-catalog calibration described in docs/product-guardrail.md.
export const DEFAULT_PRODUCT_MATCH_THRESHOLD = 0.75;
type CatalogProduct = { id: number; name: string; tags: string[] };
type ProductMatch = CatalogProduct & { similarity: number };

@Injectable()
export class ProductScopeGuardrailService {
  private readonly logger = new Logger(ProductScopeGuardrailService.name);
  private readonly threshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {
    const configured = process.env.PRODUCT_MATCH_THRESHOLD;
    this.threshold =
      configured === undefined
        ? DEFAULT_PRODUCT_MATCH_THRESHOLD
        : Number(configured);
    if (
      configured?.trim() === '' ||
      !Number.isFinite(this.threshold) ||
      this.threshold < 0 ||
      this.threshold > 1
    ) {
      throw new Error(
        'PRODUCT_MATCH_THRESHOLD must be a finite number between 0 and 1',
      );
    }
  }

  async check(message: string): Promise<GuardrailResult | null> {
    const queries = extractProductQueries(message);
    if (queries.length === 0) return null;
    try {
      const catalog = await this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, tags: true },
      });
      for (const query of queries) {
        if (!(await this.checkProductExistsInScope(query, catalog))) {
          return {
            blockReason: BLOCK_REASONS.PRODUCT_OUT_OF_SCOPE,
            responseMessage: pickHumanizedMessage(
              BLOCK_REASONS.PRODUCT_OUT_OF_SCOPE,
            ),
          };
        }
      }
      return null;
    } catch {
      // Do not expose provider/database errors or falsely claim the product is absent.
      this.logger.warn(
        'Product catalog verification failed; blocking unverified product answer',
      );
      return {
        blockReason: BLOCK_REASONS.PRODUCT_CATALOG_UNAVAILABLE,
        responseMessage: pickHumanizedMessage(
          BLOCK_REASONS.PRODUCT_CATALOG_UNAVAILABLE,
        ),
      };
    }
  }

  async checkProductExistsInScope(
    query: string,
    catalog?: CatalogProduct[],
  ): Promise<boolean> {
    const products =
      catalog ??
      (await this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, tags: true },
      }));
    // A literal name/tag phrase in the actual catalog is stronger evidence than a
    // semantic score; this also preserves products whose embedding is not populated.
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    const phrase = normalize(query);
    if (
      phrase &&
      products.some((product) =>
        [product.name, ...product.tags].some((value) =>
          ` ${normalize(value)} `.includes(` ${phrase} `),
        ),
      )
    )
      return true;

    const embedding = await this.embeddings.generateEmbeddingFromString(query);
    if (
      embedding.length !== 1024 ||
      embedding.some((value) => !Number.isFinite(value)) ||
      embedding.every((value) => value === 0)
    ) {
      throw new Error('Invalid catalog query embedding');
    }
    const vector = this.embeddings.embeddingArrayToString(embedding);
    const matches = await this.prisma.$queryRaw<ProductMatch[]>`
      SELECT id, name, tags, 1 - (embedding <=> ${vector}::vector) AS similarity
      FROM "Product"
      WHERE "isActive" = true AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector, id
      LIMIT 20
    `;
    return matches.some(
      (product) =>
        Number.isFinite(product.similarity) &&
        product.similarity >= this.threshold &&
        matchesProductIdentity(query, product),
    );
  }

  /** Output callers can discard any LLM draft using the same catalog policy. */
  async validateProductQuery(userQuery: string, llmDraftResponse: string) {
    const result = await this.check(userQuery);
    return {
      blocked: result !== null,
      response: result?.responseMessage ?? llmDraftResponse,
    };
  }
}
