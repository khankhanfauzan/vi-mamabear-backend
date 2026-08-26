import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Review } from '@/generated/prisma';
import { CreateReviewDto } from './dto/create-review.dto';

export class ReviewSummary {
    average: number;
    count_5: number;
    count_4: number;
    count_3: number;
    count_2: number;
    count_1: number;
}

@Injectable()
export class ReviewsRepository {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReviewDto): Promise<Review> {
    const { images, ...reviewsData } = dto
    return this.prisma.review.create({
      data: {
        title: dto.title,
        rating: dto.rating,
        description: dto.description,
        reviewer: { connect: { id: dto.reviewerId }},
        product: { connect: { id: dto.productId }},
        images: {
            createMany: {
              data: (images ?? []).map((img) => ({
                imageUrl: img.imageUrl,
                publicId: img.publicId,
                width: img.width,
                height: img.height,
                fileSize: img.fileSize,
                format: img.format,
                sortOrder: img.sortOrder,
                altText: img.altText,
              })),
            }
        },
      },
    });
  }

  async findProductBySlug(productSlug: string) {
      return this.prisma.product.findUnique({
          where: { slug: productSlug },
      });
  }

  async findByProductId(productId: number): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { productId },
      orderBy: { numUpvotes: "desc" }
    });
  }


  async upvoteReviewWithId(id: number): Promise<Review> {
      return this.prisma.review.update({
          where: { id },
          data: {
              numUpvotes: { increment: 1 },
          }
      });
  }

  async getReviewSummary(productId: number): Promise<ReviewSummary> {
      let groups = await this.prisma.review.groupBy({
          where: { productId },
          by: ['rating'],
          _count: { rating: true }
      });
      const counts : Record<number, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
      let total_count = 0;
      let weighted_sum = 0;
      for (const g of groups) {
          const rating = Math.round(g.rating);
          const count = g._count.rating;
          counts[rating] = count;
          total_count += count;
          weighted_sum += count * rating;
      }
      return {
          average: total_count > 0 ? weighted_sum / total_count : 0, 
          count_5: counts[5],
          count_4: counts[4],
          count_3: counts[3],
          count_2: counts[2],
          count_1: counts[1],
      }
  }


  async remove(id: number): Promise<Review> {
      return this.prisma.review.delete({
          where: { id },
      });
  }

  async findMany(args: any) {
      return this.prisma.review.findMany(args)
  }
}
