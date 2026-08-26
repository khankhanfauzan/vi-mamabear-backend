import { Injectable, NotFoundException } from '@nestjs/common';
import { ReviewsRepository, ReviewSummary } from './reviews.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { ServiceResult } from '@/common/ServiceResult';
import { Review } from '@/generated/prisma';
import {
  ReviewPaginationDto,
  ReviewSortBy,
  ReviewSortOrder,
} from './dto/review-pagination.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
  ) {}

  private buildReviewWhere(productId: number, paginationDto?: ReviewPaginationDto) {
    const where: any = { productId };

    if (paginationDto?.minRating !== undefined) {
      where.rating = { ...where.rating, gte: paginationDto.minRating };
    }
    if (paginationDto?.maxRating !== undefined) {
      where.rating = { ...where.rating, lte: paginationDto.maxRating };
    }

    return where;
  }

  private buildReviewOrderBy(paginationDto?: ReviewPaginationDto) {
    const dir = paginationDto?.sortOrder === ReviewSortOrder.ASC ? 'asc' : 'desc';

    switch (paginationDto?.sortBy) {
      case ReviewSortBy.UPVOTES:
        return { numUpvotes: dir };
      default:
        return { createdAt: dir };
    }
  }

  async findReviewsOfProduct(
    productId: number,
    paginationDto?: ReviewPaginationDto,
  ): Promise<ServiceResult<any>> {
    const limit = paginationDto?.limit ?? 10;
    const where = this.buildReviewWhere(productId, paginationDto);
    const orderBy = this.buildReviewOrderBy(paginationDto);

    const items = await this.reviewsRepository.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(paginationDto?.cursor ? { cursor: { id: paginationDto.cursor }, skip: 1 } : {}),
      include: {
        reviewer: { select: { id: true, name: true } },
        images: true,
      },
    });

    let nextCursor: number | null = null;
    if (items.length > limit) {
      items.pop();
      nextCursor = items[items.length - 1]?.id ?? null;
    }

    return {
      success: true,
      message: `Found ${items.length} reviews`,
      data: {
        success: true,
        data: items,
        pagination: { limit, nextCursor, hasNextPage: nextCursor !== null },
      },
    };
  }

  async findReviewsOfProductBySlug(
    productSlug: string,
    paginationDto?: ReviewPaginationDto,
  ): Promise<ServiceResult<any>> {
    const resolvedProduct = await this.reviewsRepository.findProductBySlug(productSlug);
    if (!resolvedProduct) throw new NotFoundException(`Cannot find product with slug ${productSlug}`);
    return this.findReviewsOfProduct(resolvedProduct.id, paginationDto);
  }

  async createReviewForProduct(dto: CreateReviewDto): Promise<ServiceResult<Review>> {
    const result = await this.reviewsRepository.create(dto);
    return {
      success: true,
      message: 'Review created successfully',
      data: result,
    };
  }
  async createReviewForProductWithSlug(slug: string, dto: CreateReviewDto): Promise<ServiceResult<Review>> {
    const resolvedProduct = await this.reviewsRepository.findProductBySlug(slug);
    if (!resolvedProduct) throw new NotFoundException(`Cannot find product with slug ${slug}`);
    dto.productId = resolvedProduct.id;
    return await this.createReviewForProduct(dto);
  }

  async upvoteReviewWithId(id: number): Promise<ServiceResult<Review>> {
    const result = await this.reviewsRepository.upvoteReviewWithId(id);
    return {
      success: true,
      message: `Review ${id} upvoted successfully`,
      data: result,
    };
  }

  async getReviewSummaryOfProductWithSlug(slug: string): Promise<ServiceResult<ReviewSummary>> {
    const resolvedProduct = await this.reviewsRepository.findProductBySlug(slug);
    if (!resolvedProduct) throw new NotFoundException(`Cannot find product with slug ${slug}`);
    const result = await this.reviewsRepository.getReviewSummary(resolvedProduct.id);
    return {
      success: true,
      message: `Review summary of product ${slug} obtained`,
      data: result,
    };
  }

  async remove(id: number): Promise<ServiceResult<Review>> {
    const result = await this.reviewsRepository.remove(id);
    return {
      success: true,
      message: `Review ${id} deleted successfully`,
      data: result,
    };
  }
}
