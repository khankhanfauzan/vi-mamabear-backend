import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { VariantRepository } from './variant.repository';
import { ServiceResult } from '@/common/ServiceResult';
import { ProductVariant } from '@/generated/prisma';
import slugify from 'slugify';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';

@Injectable()
export class VariantService {
  constructor(
    private readonly repo: VariantRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private generateSku(productSlug: string, variantValue: string): string {
    const base = `${productSlug}-${variantValue}`;
    return slugify(base, {
      lower: false,
      strict: true,
    }).toUpperCase();
  }

  async updateVariant(
    userId: number,
    variantId: number,
    dto: UpdateVariantDto,
  ): Promise<ServiceResult<ProductVariant>> {
    const variant = await this.repo.findOne(variantId);
    if (!variant) throw new BadRequestException('Variant not found');

    const product = await this.repo.findProductById(variant.productId);
    if (!product) throw new BadRequestException('Product not found');

    if (dto.name) {
      const newSku = this.generateSku(product.slug, dto.name);
      dto.sku = newSku;
    }
    const result = await this.repo.update(variantId, dto);

    return {
      success: true,
      message: 'Variant updated successfully',
      data: result,
    };
  }

  async createVariant(
    userId: number,
    productId: number,
    dto: CreateVariantDto,
  ): Promise<ServiceResult<ProductVariant>> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new BadRequestException('Product not found');

    if (!dto.sku) {
      dto.sku = this.generateSku(product.slug, dto.name);
    }

    const existingVariants =
      await this.repo.findProductVariantsByProductId(productId);
    const existingSortOrders = existingVariants.map((v) => v.sortOrder);
    const maxSortOrder =
      existingSortOrders.length > 0 ? Math.max(...existingSortOrders) : -1;

    const isSortOrderConflict =
      dto.sortOrder !== undefined && existingSortOrders.includes(dto.sortOrder);

    const finalSortOrder =
      dto.sortOrder !== undefined && !isSortOrderConflict
        ? dto.sortOrder
        : maxSortOrder + 1;

    const result = await this.repo.createProductVariant(productId, {
      ...dto,
      sortOrder: finalSortOrder,
      images: (dto.images ?? []).map((image, index) => ({
        imageUrl: image.imageUrl,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        fileSize: image.fileSize,
        format: image.format,
        altText: image.altText,
        sortOrder: index,
      })),
    });

    return {
      success: true,
      message: 'Variant created successfully',
      data: result,
    };
  }

  async getProductVariant(
    productId: number,
  ): Promise<ServiceResult<ProductVariant[]>> {
    const result = await this.repo.findProductVariantsByProductId(productId);
    return {
      success: true,
      message: `Found ${result.length} variants`,
      data: result,
    };
  }

  async getProductVariantBySlug(
    productSlug: string,
  ): Promise<ServiceResult<ProductVariant[]>> {
    const resolvedProduct = await this.repo.findProductBySlug(productSlug);

    if (!resolvedProduct) {
      throw new NotFoundException(
        `Cannot find product with slug ${productSlug}`,
      );
    }
    const result = await this.repo.findProductVariantsByProductId(
      resolvedProduct.id,
    );

    return {
      success: true,
      message: `Found ${result.length} variants for product ${productSlug}`,
      data: result,
    };
  }

  async deleteVariant(
    userId: number,
    variantId: number,
  ): Promise<ServiceResult<ProductVariant>> {
    const variant = await this.repo.findOne(variantId);
    if (!variant) throw new BadRequestException('variant not found');
    const deleted = await this.repo.delete({ id: variantId });
    return {
      success: true,
      message: `Variant ${variant.sku} deleted successfully`,
      data: deleted,
    };
  }
}
