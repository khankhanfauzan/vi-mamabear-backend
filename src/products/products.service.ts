import { map } from 'rxjs/operators';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsRepository } from './products.repository';
import { CursorPaginationRequestDto } from '@/common/dto/request/pagination.request.dto';
import { CursorPaginationService } from '@/common/services/pagination.service';
import { CursorPaginationResponseDto } from '@/common/dto/response/pagination.response.dto';
import { CreateVariantDto } from '@/variant/dto/create-variant.dto';
import { ServiceResult } from '@/common/ServiceResult';
import slugify from 'slugify';
import { Product } from '@/generated/prisma';
import { FilterProductsDto } from './dto/filter-products.dto';
import {
  FilterPaginationMetaDto,
  FilterPaginationResponseDto,
} from './dto/filter-pagination-meta.dto';
import { AdminProductsQueryDto } from './dto/admin-products-query.dto';
import {
  PagePaginationResponseDto,
  PagePaginationMetaDto,
} from '@/common/dto/response/page-pagination.response.dto';
import { BulkDeleteProductsDto } from './dto/bulk-delete-products.dto';
import { BulkUpdateProductsStatusDto } from './dto/bulk-update-products-status.dto';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly logger: PinoLogger,
    private readonly paginationService: CursorPaginationService,
    private readonly cloudinary: CloudinaryService,
  ) {
    this.logger.setContext(ProductsService.name);
  }

  private generateSku(productSlug: string, variantValue: string): string {
    const base = `${productSlug}-${variantValue}`;

    return slugify(base, {
      lower: false,
      strict: true,
    }).toUpperCase();
  }

  async findProductsWithFilter(
    query: FilterProductsDto,
  ): Promise<ServiceResult<FilterPaginationResponseDto<Product>>> {
    if (query.minPrice && query.maxPrice && query.minPrice > query.maxPrice)
      throw new UnprocessableEntityException(
        'Min price must be large than max price',
      );
    const { items, nextCursor } =
      await this.productsRepository.findByFilter(query);
    const limit = query.limit ?? 10;
    const result = new FilterPaginationResponseDto<Product>(
      items,
      new FilterPaginationMetaDto(limit, nextCursor),
    );
    return {
      success: true,
      message: `Returned ${items.length} products with the selected filters`,
      data: result,
    };
  }

  async findAdminProducts(
    query: AdminProductsQueryDto,
  ): Promise<ServiceResult<PagePaginationResponseDto<Product>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, totalItems } =
      await this.productsRepository.findAdminProducts(query);
    const meta = new PagePaginationMetaDto(page, limit, totalItems);
    const result = new PagePaginationResponseDto<Product>(items, meta);
    return {
      success: true,
      message: `Returned ${items.length} products (page ${page} of ${meta.totalPages})`,
      data: result,
    };
  }

  async findRelatedProducts(slug: string): Promise<ServiceResult<Product[]>> {
    const resolvedProduct = await this.productsRepository.findBySlug(slug);
    if (!resolvedProduct)
      throw new BadRequestException(`Cannot find product with slug ${slug}`);
    const result = await this.productsRepository.findRelated(
      resolvedProduct.id,
    );
    return {
      success: true,
      message: `Returned ${result.length} products that are similar to ${slug}`,
      data: result,
    };
  }

  async create(dto: CreateProductDto): Promise<ServiceResult<Product>> {
    try {
      if (!dto.variants) dto.variants = [];
      const setSortOrders = dto.variants.map((v) => v.sortOrder);
      const hasUndefined = setSortOrders.some(
        (s) => s === undefined || s === null,
      );
      const hasDuplicate = new Set(setSortOrders).size !== setSortOrders.length;

      const normalizedVariants = dto.variants.map((v, index) => ({
        ...v,
        sortOrder:
          hasUndefined || hasDuplicate ? index : (v.sortOrder as number),
      }));

      const maxSortOrder =
        normalizedVariants.length > 0
          ? Math.max(...normalizedVariants.map((v) => v.sortOrder as number))
          : -1;

      const defaultVariant: CreateVariantDto = {
        name: 'INTERNAL_DEFAULT',
        priceIdr: dto.priceIdr,
        weightG: dto.weightG,
        stock: dto.stock ?? 0,
        sku: dto.sku,
        sortOrder: maxSortOrder + 1,
      };

      normalizedVariants.push(defaultVariant);

      const generatedSlug = slugify(dto.name, { lower: true, strict: true });

      const result = await this.productsRepository.create({
        ...dto,
        slug: generatedSlug,
        variants: normalizedVariants,
        images: (dto.images ?? []).map((image) => ({
          imageUrl: image.imageUrl,
          publicId: image.publicId,
          width: image.width,
          height: image.height,
          fileSize: image.fileSize,
          format: image.format,
          sortOrder: image.sortOrder,
          altText: image.altText,
        })),
      });

      if (!result) throw new BadRequestException('Cannot create product');

      this.logger.info({
        message: 'Product created successfully',
        endpoint: 'POST /products',
        productId: result?.id,
        name: dto.name,
        status: 'success',
      });

      return {
        success: true,
        message: `Product ${dto.name} created successfully`,
        data: result,
      };
    } catch (error: any) {
      this.logger.error({
        message: 'Product creation failed',
        endpoint: 'POST /products',
        name: dto.name,
        status: 'error',
        error: error.message,
        code: error.code,
        meta: error.meta,
      });
      throw error;
    }
  }

  async findAll(
    paginationDto?: CursorPaginationRequestDto,
  ): Promise<ServiceResult<CursorPaginationResponseDto<Product>>> {
    try {
      const result = await this.paginationService.paginate<Product>(
        this.productsRepository,
        paginationDto,
        {},
      );
      this.logger.info({
        message: 'Retrieved all products',
        endpoint: 'GET /products',
        count: result.data.length,
        status: 'success',
      });
      return {
        success: true,
        message: `Retrieved ${result.data.length} products`,
        data: result,
      };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to retrieve products',
        endpoint: 'GET /products',
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async findOne(id: number): Promise<ServiceResult<Product>> {
    try {
      const product = await this.productsRepository.findById(id);
      if (!product) {
        this.logger.warn({
          message: 'Product not found',
          endpoint: 'GET /products/:id',
          productId: id,
          status: 'failure',
        });
        throw new NotFoundException(`Product with id ${id} not found`);
      }
      this.logger.info({
        message: 'Retrieved product by id',
        endpoint: 'GET /products/:id',
        productId: id,
        status: 'success',
      });
      return {
        success: true,
        message: `Found product with id ${id}`,
        data: product,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error({
        message: 'Failed to retrieve product',
        endpoint: 'GET /products/:id',
        productId: id,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<ServiceResult<Product>> {
    try {
      const product = await this.productsRepository.findBySlug(slug);
      if (!product) {
        this.logger.warn({
          message: 'Product not found',
          endpoint: 'GET /products/:slug',
          status: 'failure',
        });
        throw new NotFoundException(`Product with slug ${slug} not found`);
      }
      this.logger.info({
        message: 'Retrieved product by slug',
        endpoint: 'GET /products/:slug',
        slug: slug,
        status: 'success',
      });
      return {
        success: true,
        message: `Found product with slug ${slug}`,
        data: product,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error({
        message: 'Failed to retrieve product',
        endpoint: 'GET /products/:slug',
        slug: slug,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateProductDto,
  ): Promise<ServiceResult<Product>> {
    try {
      if (dto.name) {
        let generatedSlug = dto.slug
          ? dto.slug
          : slugify(dto.name, { lower: true, strict: true });
        const resolvedProduct =
          await this.productsRepository.findBySlug(generatedSlug);
        if (resolvedProduct && resolvedProduct.id != id)
          // there exists another product with same slug
          throw new BadRequestException(
            `Product with slug ${generatedSlug} already exists`,
          );
        dto.slug = generatedSlug;
      }

      const result = await this.productsRepository.update(id, dto);
      this.logger.info({
        message: 'Product updated successfully',
        endpoint: 'PUT /products/:id',
        productId: id,
        status: 'success',
      });
      return {
        success: true,
        message: `Product updated successfully`,
        data: result,
      };
    } catch (error: any) {
      this.logger.error({
        message: 'Product update failed',
        endpoint: 'PUT /products/:id',
        productId: id,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async remove(id: number): Promise<ServiceResult<Product>> {
    try {
      const result = await this.productsRepository.delete(id);
      this.logger.info({
        message: 'Product deleted successfully',
        endpoint: 'DELETE /products/:id',
        productId: id,
        status: 'success',
      });
      return {
        success: true,
        message: `Product deleted successfully`,
        data: result,
      };
    } catch (error: any) {
      this.logger.error({
        message: 'Product deletion failed',
        endpoint: 'DELETE /products/:id',
        productId: id,
        status: 'error',
        error: error.message,
      });
      if (
        error.code === 'P2003' ||
        error.message?.includes('foreign key constraint')
      ) {
        throw new ConflictException(
          'Cannot delete product: it is referenced by existing orders or cart items',
        );
      }
      throw error;
    }
  }

  async bulkDelete(
    dto: BulkDeleteProductsDto,
  ): Promise<ServiceResult<{ deletedCount: number }>> {
    console.log('DTO:', dto);
    const result = await this.productsRepository.bulkDelete(dto.ids);

    console.log('RESULT:', result);

    return {
      success: true,
      message: `Successfully deleted ${result.count} products`,
      data: { deletedCount: result.count },
    };
  }

  async bulkUpdateProductStatus(
    dto: BulkUpdateProductsStatusDto,
  ): Promise<ServiceResult<{ updatedCount: number }>> {
    const result = await this.productsRepository.bulkUpdateProductStatus({
      ids: dto.ids,
      isActive: dto.isActive,
    });

    return {
      success: true,
      message: `Successfully updated status for ${result.count} products to ${dto.isActive ? 'active' : 'inactive'}`,
      data: { updatedCount: result.count },
    };
  }

  async exportProducts(): Promise<ServiceResult<any>> {
    const products = await this.productsRepository.findAllForExport();

    const exportData = products.map((p) => {
      const prices = p.variants.map((v) => Number(v.priceIdr));

      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      const totalStock = p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);

      return {
        name: p.name,
        sku: p.variants[0]?.sku ?? '-',
        priceIdr:
          minPrice === maxPrice ? minPrice : `${minPrice} - ${maxPrice}`,
        stock: totalStock,
        totalSold: p.totalSold,
        category: p.category?.name ?? '-',
      };
    });

    return {
      success: true,
      message: 'Product exported successfully',
      data: exportData,
    };
  }

  async duplicateProduct(productId: number): Promise<ServiceResult<Product>> {
    const product =
      await this.productsRepository.findProductForDuplicate(productId);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const duplicatedSlug = `${product.slug}-copy-${Date.now()}`;

    const duplicatedProductImages = await Promise.all(
      product.images.map(async (image) => {
        const uploaded = await this.cloudinary.duplicateImage(image.imageUrl);

        return {
          publicId: uploaded.publicId,
          imageUrl: uploaded.imageUrl,
          width: uploaded.width,
          height: uploaded.height,
          fileSize: uploaded.fileSize,
          format: uploaded.format,
          altText: image.altText,
          sortOrder: image.sortOrder,
        };
      }),
    );

    const duplicatedVariants = await Promise.all(
      product.variants.map(async (variant) => {
        const duplicatedVariantImages = await Promise.all(
          variant.images.map(async (image) => {
            const uploaded = await this.cloudinary.duplicateImage(
              image.imageUrl,
            );

            return {
              publicId: uploaded.publicId,
              imageUrl: uploaded.imageUrl,
              width: uploaded.width,
              height: uploaded.height,
              fileSize: uploaded.fileSize,
              format: uploaded.format,
              altText: image.altText,
              sortOrder: image.sortOrder,
            };
          }),
        );

        return {
          name: variant.name,

          sku: this.generateSku(duplicatedSlug, variant.name),

          priceIdr: variant.priceIdr,
          weightG: variant.weightG,
          stock: variant.stock,
          sortOrder: variant.sortOrder,

          images: {
            create: duplicatedVariantImages,
          },

          ...(variant.discount && {
            discount: {
              create: {
                amount: variant.discount.amount,
                isPercent: variant.discount.isPercent,
                startedAt: variant.discount.startedAt,
                endsAt: variant.discount.endsAt,
              },
            },
          }),
        };
      }),
    );

    const result = await this.productsRepository.createDuplicatedProduct({
      name: `${product.name} (Copy)`,

      slug: duplicatedSlug,

      isActive: false,
      totalSold: 0,

      categoryId: product.categoryId,
      highlightId: product.highlightId,

      description: product.description,
      ingredients: product.ingredients,
      usageInstructions: product.usageInstructions,

      tags: product.tags,

      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,

      images: {
        create: duplicatedProductImages,
      },

      variants: {
        create: duplicatedVariants,
      },
    });

    return {
      success: true,
      message: `Product ${product.name} duplicated successfully`,
      data: result,
    };
  }
}
