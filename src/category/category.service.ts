import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryRepository } from './category.repository';
import { ServiceResult } from '@/common/ServiceResult';
import { Category } from '@/generated/prisma';
import slugify from 'slugify';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';

@Injectable()
export class CategoryService {
  constructor(
    private readonly repo: CategoryRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async getAllCategory(): Promise<ServiceResult<Category[]>> {
    const result = await this.repo.findAll();
    return {
      success: true,
      message: `Found ${result.length} categories`,
      data: result ?? [],
    };
  }

  async getCategoryById(id: number): Promise<ServiceResult<Category>> {
    const result = await this.repo.findById(id);
    if (!result)
      throw new NotFoundException(`Category with id ${id} not found`);
    return {
      success: true,
      message: `Category with id ${id} found`,
      data: result,
    };
  }
  async getCategoryBySlug(slug: string): Promise<ServiceResult<Category>> {
    const result = await this.repo.findBySlug(slug);
    if (!result)
      throw new NotFoundException(`Category with slug ${slug} not found`);
    return {
      success: true,
      message: `Category with slug ${slug} found`,
      data: result,
    };
  }

  async createCategory(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<ServiceResult<Category>> {
    const generatedSlug = slugify(dto.name, { lower: true, strict: true });

    const resolvedCategory = await this.repo.findBySlug(generatedSlug);

    if (resolvedCategory)
      throw new BadRequestException('Category already exists');

    dto.slug = generatedSlug;

    const result = await this.repo.create(dto);

    return {
      success: true,
      message: `Category ${dto.name} created successfully`,
      data: result,
    };
  }

  async updateCategory(
    userId: string,
    categoryId: number,
    dto: UpdateCategoryDto,
  ): Promise<ServiceResult<Category>> {
    const resolvedCategory = await this.repo.findById(categoryId);
    if (!resolvedCategory) throw new BadRequestException('Category not found');

    if (dto.name) {
      const generatedSlug = dto.slug ? dto.slug : slugify(dto.name, { lower: true, strict: true });
      const category = await this.repo.findBySlug(generatedSlug);
      if (category && category.id != categoryId) // another category with same resulting slug
        throw new BadRequestException(
          'Name update generates a slug that already exists, or dto.slug is a slug that already exists',
        );
      dto.slug = generatedSlug;
    }

    const category = await this.repo.update(categoryId, dto);

    return {
      success: true,
      message: `Category ${category.name} updated successfully`,
      data: category,
    };
  }

  async deleteCategory(
    userId: string,
    categoryId: number,
  ): Promise<ServiceResult<Category>> {
    const category = await this.repo.findById(categoryId);
    if (!category) throw new BadRequestException('Category not found');
    if (category.products.length > 0)
      throw new BadRequestException('Category has products');
    const deletedCategory = await this.repo.delete(categoryId);

    return {
      success: true,
      message: `${category.name} deleted successfully`,
      data: deletedCategory,
    };
  }
}
