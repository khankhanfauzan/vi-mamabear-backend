import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { EmbeddingsService } from '@/embeddings/embeddings.service';
import { ProductUtils } from '@/product-utils/product-utils';
import { Image, Prisma, Product } from '@/generated/prisma';
import { FilterProductsDto } from './dto/filter-products.dto';
import {
  AdminProductsQueryDto,
  AdminProductSortBy,
  SortOrder,
} from './dto/admin-products-query.dto';
import { PinoLogger } from 'pino-nestjs';
import { BadRequestException } from '@nestjs/common';

export const PRODUCT_INCLUDE = {
  category: true,
  images: true,
  variants: {
    include: {
      images: true,
    },
  },
  highlight: true,
};

type SortConfig = {
  orderByClause: string;
  cursorKeys: string[];
};

@Injectable()
export class ProductsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: ProductUtils,
    private readonly embedService: EmbeddingsService,
    private readonly logger: PinoLogger,
  ) {}

  async create(data: CreateProductDto) {
    const { images, variants, weightG, priceIdr, stock, sku, ...productData } =
      data;

    const product = await this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          ...productData,
          variants: variants?.length
            ? {
                create: variants.map((v, index) => ({
                  name: v.name,
                  priceIdr: v.priceIdr,
                  weightG: v.weightG,
                  sku: v.sku ?? null,
                  stock: v.stock ?? 0,
                  sortOrder: v.sortOrder ?? index,
                  images: v.images?.length
                    ? {
                        createMany: {
                          data: v.images.map((img) => ({
                            imageUrl: img.imageUrl,
                            publicId: img.publicId,
                            width: img.width ?? null,
                            height: img.height ?? null,
                            fileSize: img.fileSize ?? null,
                            format: img.format ?? null,
                            sortOrder: img.sortOrder ?? 0,
                            altText: img.altText ?? null,
                          })),
                        },
                      }
                    : undefined,
                })),
              }
            : undefined,
          images: images?.length
            ? {
                createMany: {
                  data: images.map((img) => ({
                    imageUrl: img.imageUrl,
                    publicId: img.publicId,
                    width: img.width ?? null,
                    height: img.height ?? null,
                    fileSize: img.fileSize ?? null,
                    format: img.format ?? null,
                    sortOrder: img.sortOrder ?? 0,
                    altText: img.altText ?? null,
                  })),
                },
              }
            : undefined,
        },
        include: PRODUCT_INCLUDE,
      });
    });

    try {
      const embed =
        await this.embedService.generateEmbeddingsFromProduct(product);

      await this.prisma.$executeRaw`
      UPDATE "Product"
      SET embedding = ${this.embedService.embeddingArrayToString(embed)}::vector
      WHERE id = ${product.id}
    `;
    } catch (embedError: any) {
      this.logger.warn({
        message:
          'Embedding generation failed, product created without embedding',
        productId: product.id,
        error: embedError.message,
      });
    }

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: PRODUCT_INCLUDE,
    });
  }

  async findMany(args?: any) {
    const { select, include, ...other } = args;
    const products = await this.prisma.product.findMany({
      ...other,
    });
    return this.utils.enrichMany(products);
  }

  private getSortConfig(query: FilterProductsDto): SortConfig {
    if (query.priceAscending !== undefined) {
      const dir = query.priceAscending === 1 ? 'ASC' : 'DESC';
      return {
        orderByClause: `MIN(pv."priceIdr") ${dir}, p.id ${dir}`,
        cursorKeys: ['minPrice', 'id'],
      };
    }
    if (query.creationDateAscending !== undefined) {
      const dir = query.creationDateAscending === 1 ? 'ASC' : 'DESC';
      return {
        orderByClause: `p."createdAt" ${dir}, p.id ${dir}`,
        cursorKeys: ['createdAt', 'id'],
      };
    }
    return {
      orderByClause: `p."createdAt" DESC, p.id DESC`,
      cursorKeys: ['createdAt', 'id'],
    };
  }

  private decodeCursor(cursorStr: string): Record<string, any> | null {
    try {
      return JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf-8'));
    } catch {
      return null;
    }
  }

  private encodeCursor(values: Record<string, any>): string {
    return Buffer.from(JSON.stringify(values)).toString('base64');
  }

  private buildCursorCondition(
    sortConfig: SortConfig,
    decoded: Record<string, any>,
    params: any[],
  ): { condition: string; params: any[] } {
    if (
      sortConfig.cursorKeys.includes('minPrice') &&
      decoded.minPrice !== undefined
    ) {
      const dir = sortConfig.orderByClause.includes('ASC') ? '>=' : '<=';
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      params.push(decoded.minPrice, decoded.id);
      return {
        condition: `AND (MIN(pv."priceIdr"), p.id) ${dir} ($${p1}, $${p2})`,
        params,
      };
    }
    if (
      sortConfig.cursorKeys.includes('createdAt') &&
      decoded.createdAt !== undefined
    ) {
      const dir = sortConfig.orderByClause.includes('ASC') ? '>=' : '<=';
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      params.push(new Date(decoded.createdAt), decoded.id);
      return {
        condition: `AND (p."createdAt", p.id) ${dir} ($${p1}::timestamp, $${p2})`,
        params,
      };
    }
    const p1 = params.length + 1;
    params.push(decoded.id);
    return {
      condition: `AND p.id >= $${p1}`,
      params,
    };
  }

  private buildFuzzySearchClause(
    search: string,
    threshold: number,
    params: any[],
  ): { clause: string; params: any[] } {
    const pQuery = params.length + 1;
    const pThreshold = params.length + 2;
    params.push(search, threshold);
    return {
      clause: `AND (similarity(p.name, $${pQuery}) >= $${pThreshold}
              OR similarity(p.slug, $${pQuery}) >= $${pThreshold}
              OR similarity(COALESCE(p.description, ''), $${pQuery}) >= $${pThreshold})`,
      params,
    };
  }

  async findByFilter(query: FilterProductsDto) {
    const limit = query.limit ?? 10;
    const sortConfig = this.getSortConfig(query);
    const decodedCursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const params: any[] = [];

    const needsVariantJoin =
      query.priceAscending !== undefined ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      query.inStock;

    const whereParts: string[] = ['WHERE 1=1'];

    if (query.categories && query.categories.length > 0) {
      const placeholders = query.categories.map(() => `$${params.length + 1}`);
      params.push(...query.categories);
      whereParts.push(`AND c.slug IN (${placeholders.join(',')})`);
    }
    if (query.highlights && query.highlights.length > 0) {
      const placeholders = query.highlights.map(() => `$${params.length + 1}`);
      params.push(...query.highlights);
      whereParts.push(`AND h.slug IN (${placeholders.join(',')})`);
    }

    if (query.search) {
      const threshold = query.similarityThreshold ?? 0.05;
      const { clause } = this.buildFuzzySearchClause(
        query.search,
        threshold,
        params,
      );
      whereParts.push(clause);
    }

    const havingParts: string[] = [];
    if (query.inStock) {
      havingParts.push(
        needsVariantJoin
          ? `AND SUM(CASE WHEN pv.stock >= 1 THEN 1 ELSE 0 END) > 0`
          : '',
      );
    }
    if (query.minPrice !== undefined) {
      const p = params.length + 1;
      params.push(query.minPrice);
      havingParts.push(`AND MIN(pv."priceIdr") >= $${p}`);
    }
    if (query.maxPrice !== undefined) {
      const p = params.length + 1;
      params.push(query.maxPrice);
      havingParts.push(`AND MIN(pv."priceIdr") <= $${p}`);
    }

    let cursorCondition = '';
    if (decodedCursor) {
      const result = this.buildCursorCondition(
        sortConfig,
        decodedCursor,
        params,
      );
      cursorCondition = result.condition;
    }

    const variantJoin = needsVariantJoin
      ? `LEFT JOIN "ProductVariant" pv ON pv."productId" = p.id`
      : '';
    const categoryJoin = `LEFT JOIN "Category" c ON c.id = p."categoryId"`;
    const highlightJoin = `LEFT JOIN "Highlight" h ON h.id = p."highlightId"`;

    const selectPrice =
      query.priceAscending !== undefined
        ? `, MIN(pv."priceIdr") as "minPrice"`
        : '';

    let orderByClause = sortConfig.orderByClause;
    if (query.search) {
      const pSearch = params.findIndex(
        (p) => typeof p === 'string' && p === query.search,
      );
      if (pSearch !== -1) {
        orderByClause = `similarity(p.name, $${pSearch + 1}) DESC, ${orderByClause}`;
      }
    }

    const offsetParam = params.length + 1;
    params.push(limit + 1);

    const rawQuery = `
      SELECT p.id ${selectPrice}
      FROM "Product" p
      ${categoryJoin}
      ${highlightJoin}
      ${variantJoin}
      ${whereParts.join(' ')}
      GROUP BY p.id
      HAVING 1=1 ${havingParts.length > 0 ? `${havingParts.join(' ')}` : ''}
      ${cursorCondition}
      ORDER BY ${orderByClause}
      LIMIT $${offsetParam}
    `;
    this.logger.info(`rawQuery: ${rawQuery}`);

    const rows: any[] = await this.prisma.$queryRawUnsafe(rawQuery, ...params);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const nextRow = rows.pop();
      const cursorValues: Record<string, any> = { id: nextRow.id };
      if (nextRow.minPrice !== undefined && nextRow.minPrice !== null) {
        cursorValues.minPrice = Number(nextRow.minPrice);
      }
      if (nextRow.createdAt !== undefined && nextRow.createdAt !== null) {
        cursorValues.createdAt = nextRow.createdAt;
      }
      nextCursor = this.encodeCursor(cursorValues);
    }

    const ids = rows.map((r: any) => r.id);
    if (ids.length === 0) {
      return { items: [], nextCursor: null };
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: PRODUCT_INCLUDE,
    });

    const orderMap = new Map(
      ids.map((id: number, index: number) => [id, index]),
    );
    const sortedProducts = products.sort(
      (a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!,
    );

    return {
      items: await this.utils.enrichMany(sortedProducts),
      nextCursor,
    };
  }

  async findAdminProducts(query: AdminProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const params: any[] = [];

    const needsVariantJoin =
      query.sortBy === AdminProductSortBy.PRICE ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      query.inStock;

    const whereParts: string[] = ['WHERE 1=1'];

    if (query.categoryId !== undefined) {
      const p = params.length + 1;
      params.push(query.categoryId);
      whereParts.push(`AND p."categoryId" = $${p}`);
    }
    if (query.isActive !== undefined) {
      const p = params.length + 1;
      params.push(query.isActive);
      whereParts.push(`AND p."isActive" = $${p}`);
    }
    if (query.search) {
      const threshold = query.similarityThreshold ?? 0.05;
      const { clause } = this.buildFuzzySearchClause(
        query.search,
        threshold,
        params,
      );
      whereParts.push(clause);
    }

    const havingParts: string[] = [];
    if (query.inStock) {
      havingParts.push(
        `AND SUM(CASE WHEN pv.stock >= 1 THEN 1 ELSE 0 END) > 0`,
      );
    }
    if (query.minPrice !== undefined) {
      const p = params.length + 1;
      params.push(query.minPrice);
      havingParts.push(`AND MIN(pv."priceIdr") >= $${p}`);
    }
    if (query.maxPrice !== undefined) {
      const p = params.length + 1;
      params.push(query.maxPrice);
      havingParts.push(`AND MIN(pv."priceIdr") <= $${p}`);
    }

    const variantJoin = needsVariantJoin
      ? `LEFT JOIN "ProductVariant" pv ON pv."productId" = p.id`
      : '';

    let orderByClause: string;
    switch (query.sortBy) {
      case AdminProductSortBy.NAME: {
        const dir = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
        orderByClause = `p.name ${dir}, p.id ${dir}`;
        break;
      }
      case AdminProductSortBy.PRICE: {
        const dir = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
        orderByClause = `MIN(pv."priceIdr") ${dir}, p.id ${dir}`;
        break;
      }
      case AdminProductSortBy.TOTAL_SOLD: {
        const dir = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
        orderByClause = `p."totalSold" ${dir}, p.id ${dir}`;
        break;
      }
      default: {
        const dir = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
        orderByClause = `p."createdAt" ${dir}, p.id ${dir}`;
        break;
      }
    }

    if (query.search) {
      const pSearch = params.findIndex(
        (p) => typeof p === 'string' && p === query.search,
      );
      if (pSearch !== -1) {
        orderByClause = `similarity(p.name, $${pSearch + 1}) DESC, ${orderByClause}`;
      }
    }

    const selectPrice =
      query.sortBy === AdminProductSortBy.PRICE
        ? `, MIN(pv."priceIdr") as "minPrice"`
        : '';

    const offsetParam = params.length + 1;
    const limitParam = params.length + 2;
    params.push(offset, limit);

    const rawQuery = `
      SELECT p.id ${selectPrice}, COUNT(*) OVER() AS "totalCount"
      FROM "Product" p
      ${variantJoin}
      ${whereParts.join(' ')}
      GROUP BY p.id
      HAVING 1=1 ${havingParts.length > 0 ? havingParts.join(' ') : ''}
      ORDER BY ${orderByClause}
      OFFSET $${offsetParam}
      LIMIT $${limitParam}
    `;
    this.logger.info(`findAdminProducts query: ${rawQuery}`);

    const rows: any[] = await this.prisma.$queryRawUnsafe(rawQuery, ...params);

    const totalItems = rows.length > 0 ? Number(rows[0].totalCount) : 0;
    const ids = rows.map((r: any) => r.id);

    if (ids.length === 0) {
      return { items: [], totalItems: 0 };
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: PRODUCT_INCLUDE,
    });

    const orderMap = new Map(
      ids.map((id: number, index: number) => [id, index]),
    );
    const sortedProducts = products.sort(
      (a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!,
    );

    return {
      items: await this.utils.enrichMany(sortedProducts),
      totalItems,
    };
  }

  async findById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    return this.utils.enrichOne(product as Product);
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: PRODUCT_INCLUDE,
    });
    return this.utils.enrichOne(product as Product);
  }
  async findRelated(id: number) {
    const rows: any[] = await this.prisma.$queryRaw`
        SELECT id, 1 - (embedding <=> (SELECT embedding FROM "Product" WHERE id = ${id})) AS similarity
        FROM "Product" p
        WHERE p.id != ${id} AND embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 5
    `;
    const ids = rows.map((row) => row.id);
    const result = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: PRODUCT_INCLUDE,
    });
    return this.utils.enrichMany(result);
  }

  update(id: number, data: UpdateProductDto) {
    const { images, variants, weightG, priceIdr, stock, sku, ...productData } =
      data;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: productData,
        include: PRODUCT_INCLUDE,
      });
      let imageUpserts: Image[] = [];
      if (images && images.length > 0) {
        imageUpserts = await Promise.all(
          images.map(async (img) => {
            return await tx.image.upsert({
              where: { publicId: img.publicId },
              update: {
                sortOrder: img.sortOrder,
                altText: img.altText,
                productId: id,
              },
              create: { ...img, productId: id },
            });
          }),
        );
      }
      return { ...product, images: product.images.concat(imageUpserts ?? []) };
    });
  }

  delete(id: number) {
    return this.prisma.product.delete({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
  }

  bulkDelete(ids: number[]) {
    return this.prisma.product.deleteMany({
      where: { id: { in: ids } },
    });
  }

  bulkUpdateProductStatus(data: { ids: number[]; isActive: boolean }) {
    return this.prisma.product.updateMany({
      where: { id: { in: data.ids } },
      data: { isActive: data.isActive },
    });
  }

  findAllForExport() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        name: true,
        category: {
          select: {
            name: true,
          },
        },
        variants: {
          select: {
            sku: true,
            priceIdr: true,
            stock: true,
          },
        },
        totalSold: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findProductForDuplicate(productId: number) {
    return this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        variants: {
          include: {
            images: true,
            discount: true,
          },
        },
      },
    });
  }

  async createDuplicatedProduct(data: any) {
    return this.prisma.product.create({
      data,
      include: {
        images: true,
        variants: {
          include: {
            images: true,
            discount: true,
          },
        },
      },
    });
  }
}
