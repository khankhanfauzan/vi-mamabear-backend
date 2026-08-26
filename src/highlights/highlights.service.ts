import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { HighlightsRepository } from './highlights.repository';
import { ServiceResult } from '@/common/ServiceResult';
import slugify from 'slugify';
import { Highlight } from '@/generated/prisma';

@Injectable()
export class HighlightsService {
  constructor(private readonly repo: HighlightsRepository) {}

  async create(dto: CreateHighlightDto): Promise<ServiceResult<Highlight>> {
    const generatedSlug = slugify(dto.name, { lower: true, strict: true });

    const existing = await this.repo.findBySlug(generatedSlug);
    if (existing) throw new BadRequestException('Highlight already exists');

    const result = await this.repo.create({
      name: dto.name,
      slug: generatedSlug,
      description: dto.description,
      isActive: dto.isActive,
    });

    return {
        success: true,
        message: `Created highlight ${result.slug}`,
        data: result,
    }
  }

  async findAll(): Promise<ServiceResult<Highlight[]>> {
    const result = await this.repo.findAll() ?? []; 
    return {
        success: true,
        message: `Found ${result.length} highlights`,
        data: result
    }
  }

  async findOne(id: number): Promise<ServiceResult<Highlight>> {
    const highlight = await this.repo.findById(id);
    if (!highlight) throw new BadRequestException('Highlight not found');
    return {
        success: true,
        message: `Found highlight with id ${id}`,
        data: highlight,
    }
  }

  async update(id: number, dto: UpdateHighlightDto): Promise<ServiceResult<Highlight>> {
    const highlight = await this.repo.findById(id);
    if (!highlight) throw new BadRequestException('Highlight not found');

    if (dto.name) {
      const generatedSlug = slugify(dto.name, { lower: true, strict: true });
      const existing = await this.repo.findBySlug(generatedSlug);
      if (existing) throw new BadRequestException('Highlight already exists');
      dto.slug = generatedSlug;
    }

    const result = await this.repo.update({ id }, dto);

    return {
      success: true,
      message: `Highlight ${result.slug} updated successfully`,
      data: result,
    };
  }

  async remove(id: number): Promise<ServiceResult<Highlight>> {
    const highlight = await this.repo.findById(id);
    if (!highlight) throw new BadRequestException('Highlight not found');
    if (highlight.products.length > 0)
      throw new BadRequestException('Highlight has products');

    const deletedHighlight = await this.repo.delete({ id });

    return {
      success: true,
      message: `${highlight.name} deleted successfully`,
      data: deletedHighlight,
    };
  }
}
