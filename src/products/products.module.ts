import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { ProductsController } from './products.controller';
import { ProductsAdminController } from './products-admin.controller';
import { ReviewsModule } from '@/reviews/reviews.module';
import { DiscountsModule } from '@/discounts/discounts.module';
import { VariantModule } from '@/variant/variant.module';
import { CloudinaryModule } from '@/cloudinary/cloudinary.module';
import { SearchModule } from '@/search/search.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { ProductUtilsModule } from '@/product-utils/product-utils.module';
import { CursorPaginationService } from '@/common/services/pagination.service';

@Module({
  imports: [
      ProductUtilsModule,
      ReviewsModule,
      DiscountsModule,
      VariantModule,
      CloudinaryModule,
      SearchModule,
      EmbeddingsModule
  ],
  controllers: [ProductsController, ProductsAdminController],
  providers: [ProductsService, ProductsRepository, CursorPaginationService],
})
export class ProductsModule {}
