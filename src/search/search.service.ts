import { ForbiddenException, Injectable } from '@nestjs/common';
import { SearchRequestDto } from './dto/search-request.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Product } from '@/generated/prisma';
import { SearchAutocompleteOptionsDto } from './dto/search-autocomplete-options.dto';
import { ServiceResult } from '@/common/ServiceResult';
import { Sql } from '@prisma/client-runtime-utils';
import { PRODUCT_INCLUDE, ProductsRepository } from '@/products/products.repository';
import { ProductUtils } from '@/product-utils/product-utils';

@Injectable()
export class SearchService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly productUtils: ProductUtils,
    ) {}

    async findProductsMatchingQuery(query: SearchRequestDto): Promise<ServiceResult<any>> {
        const limit = query.limit ?? 10;

        const searchTerm = query.q;

        const matchedProductIds = await this.prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { slug: { contains: searchTerm, mode: 'insensitive' } },
                    { tags: { has: searchTerm } },
                ],
            },
            select: { id: true },
        });

        const variantMatchedProducts = await this.prisma.productVariant.findMany({
            where: {
                sku: { contains: searchTerm, mode: 'insensitive' },
            },
            select: { productId: true },
        });

        const seen = new Set<number>();
        const allIds: number[] = [];
        for (const p of matchedProductIds) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                allIds.push(p.id);
            }
        }
        for (const v of variantMatchedProducts) {
            if (!seen.has(v.productId)) {
                seen.add(v.productId);
                allIds.push(v.productId);
            }
        }

        if (allIds.length === 0) {
            return {
                success: true,
                message: `Found 0 products matching query '${query.q}'`,
                data: {
                    success: true,
                    data: [],
                    pagination: { limit, nextCursor: null, hasNextPage: false },
                },
            };
        }

        const where: any = { id: { in: allIds } };
        if (query.cursor) {
            where.id = { in: allIds, lt: query.cursor };
        }

        const products = await this.prisma.product.findMany({
            where,
            include: PRODUCT_INCLUDE,
            take: limit + 1,
            orderBy: { id: 'desc' },
        });

        let nextCursor: number | null = null;
        if (products.length > limit) {
            products.pop();
            nextCursor = products[products.length - 1]?.id ?? null;
        }

        const enriched = await this.productUtils.enrichMany(products);

        return {
            success: true,
            message: `Found ${enriched.length} products matching query '${query.q}'`,
            data: {
                success: true,
                data: enriched,
                pagination: { limit, nextCursor, hasNextPage: nextCursor !== null },
            },
        };
    }

    async getFuzzyAutocompleteResults(query: SearchRequestDto, options?: SearchAutocompleteOptionsDto) {
        const defaultOptions: SearchAutocompleteOptionsDto = {
            limit: 3,
            minChars: 3,
            similarityThreshold: 0.02,
        }
        const limit = options?.limit || defaultOptions.limit!;
        const minChars = options?.minChars! || defaultOptions.minChars!;
        const similarityThreshold = options?.similarityThreshold! || defaultOptions.similarityThreshold!;
        if(query.q && query.q?.trim().length < minChars) {
            return {
                success: true,
                message: `Query should be at least ${minChars} chars long to activate fuzzy searching`,
                data: []
            }
        }
        var matchedProducts: (Product & { similarity: number })[] = await this.prisma.$queryRaw`
        SELECT name, similarity(name, ${query.q}) AS similarity
        FROM "Product"
        WHERE similarity(name, ${query.q}) >= ${similarityThreshold}
        ORDER BY similarity DESC
        LIMIT ${limit}
        `;
        return {
            success: true,
            message: `Found ${matchedProducts.length} products matching query '${query.q}' with fuzzy search`,
            data: matchedProducts
        };
    }

    async matchProductsByName(query: SearchRequestDto) {
        return this.prisma.product.findMany({
            where: {
                name: { contains: query.q, mode: 'insensitive' },
            },
            include: PRODUCT_INCLUDE,
        })
    }

    matchProductsByDescription(query: SearchRequestDto) {
        return this.prisma.product.findMany({
            where: {
                description: { contains: query.q, mode: 'insensitive' },
            },
            include: PRODUCT_INCLUDE,
        })
    }

    matchProductsByTags(query: SearchRequestDto) {
        return this.prisma.product.findMany({
            where: {
                tags: { has: query.q },
            },
            include: PRODUCT_INCLUDE,
        })
    }

    matchProductsBySlug(query: SearchRequestDto) {
        return this.prisma.product.findMany({
            where: {
                slug: { contains: query.q, mode: 'insensitive' },
            },
            include: PRODUCT_INCLUDE,
        })
    }

    async matchProductsByVariantSku(query: SearchRequestDto) {
        const matchedVariants = await this.prisma.productVariant.findMany({
            where: {
                sku: { contains: query.q, mode: 'insensitive' },
            },
            select: { product: { include: PRODUCT_INCLUDE } },
        })
        var seen = {};
        var uniqueProducts: Product[] = [];
        matchedVariants.forEach((variant) => {
            if(!seen[variant.product.id]) {
                seen[variant.product.id] = true;
                uniqueProducts.push(variant.product);
            }
            uniqueProducts.push(variant.product);
        })
        return uniqueProducts;
    }
}
