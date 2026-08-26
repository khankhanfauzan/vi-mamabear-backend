import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryAdminController } from './category-admin.controller';
import { CategoryRepository } from './category.repository';
import { CloudinaryModule } from '@/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [CategoryController, CategoryAdminController],
  providers: [CategoryService, CategoryRepository],
})
export class CategoryModule {}
