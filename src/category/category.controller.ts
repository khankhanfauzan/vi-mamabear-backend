import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll() {
    return this.categoryService.getAllCategory();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.categoryService.getCategoryBySlug(slug);
  }
}
