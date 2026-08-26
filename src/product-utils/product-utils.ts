import { PrismaService } from "@/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { Product, Discount } from "@/generated/prisma";
import { Decimal } from "@prisma/client-runtime-utils";


@Injectable()
export class ProductUtils {
    constructor(private readonly prisma: PrismaService) {}
    async enrichOne(product: Product) {
        if(!product) return product;
        const defaultPrice = await this.prisma.productVariant.findUnique({
            select: { productId: true, priceIdr: true, discount: true },
            where: { variantCompositeIdentifier: {
                productId: product.id,
                sortOrder: 0,
            }},
        })
        const reviews = await this.prisma.review.aggregate({
            where: { productId: product.id },
            _avg: { rating: true },
            _count: { rating: true },
        })
        const topReview = await this.prisma.review.findFirst({
            where: { productId: product.id },
            orderBy: { numUpvotes: "desc"  },
        })
        return {
            ...product,
            currentPrice: this.getDiscountedPrice(defaultPrice?.priceIdr!, defaultPrice?.discount as Discount),
            originalPrice: defaultPrice?.priceIdr,
            discountPercent: this.getDiscountPercent(defaultPrice?.priceIdr!, defaultPrice?.discount as Discount),
            rating: reviews._avg.rating,
            reviewsCount: reviews._count.rating,
            topReview: topReview
        }
    }

    async enrichMany(products: Product[]) {
        const ids = products.map(p => p.id);
        const reviews = await this.prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: ids }},
            _avg: { rating: true },
            _count: { rating: true },
        })
        const reviewsMap = new Map(
            reviews.map(r => [r.productId, { avg: r._avg.rating, count: r._count.rating }])
        );
        const defaultPrices = await this.prisma.productVariant.findMany({
            select: { productId: true, priceIdr: true, discount: true },
            where: { productId: { in: ids }, sortOrder: 0 },
        })
        const priceMap = new Map(
            defaultPrices.map(p => [p.productId, { 
                originalPrice: p.priceIdr,
                price: this.getDiscountedPrice(p.priceIdr, p.discount as Discount),
                discountPercent: this.getDiscountPercent(p.priceIdr, p.discount as Discount),
            }])
        );
        return products.map(product => ({
            ...product,
            currentPrice: priceMap.get(product.id)?.price,
            originalPrice: priceMap.get(product.id)?.originalPrice,
            discountPercent: priceMap.get(product.id)?.discountPercent,
            rating: reviewsMap.get(product.id)?.avg,
            reviewsCount: reviewsMap.get(product.id)?.count,
        }));
    }

    private getDiscountPercent(priceIdr: Decimal, discount: Discount) {
        if(!discount) return 0;
        if(discount.isPercent) return discount.amount;
        else return new Decimal(discount.amount).div(priceIdr).mul(100);
    }
    private getDiscountedPrice(priceIdr: Decimal, discount: Discount) {
        if(!discount) return priceIdr;
        if(discount.isPercent) return priceIdr.mul(Decimal(100).minus(discount.amount)).div(100);
        else return priceIdr.minus(discount.amount);
    }


}

