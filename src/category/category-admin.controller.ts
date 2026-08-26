import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { AdminActivityLogService } from '@/activity-log/admin-activity-log.service';

@ApiTags('categories (admin)')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard)
@Roles([Role.ADMIN])
@ApiBearerAuth('JwtAuthGuard')
export class CategoryAdminController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly activityLogService: AdminActivityLogService,
  ) {}

  @Post()
  async create(
    @Req() req: any,
    @Body() dto: CreateCategoryDto,
  ) {
    const result = await this.categoryService.createCategory(req.user.id, dto);
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'CREATE', 'Category', String(result.data.id));
    }
    return result;
  }

  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id') categoryId: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    const result = await this.categoryService.updateCategory(
      req.user.id,
      categoryId,
      dto,
    );
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'UPDATE', 'Category', String(categoryId));
    }
    return result;
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') categoryId: number) {
    const result = await this.categoryService.deleteCategory(req.user.id, categoryId);
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'DELETE', 'Category', String(categoryId));
    }
    return result;
  }
}
