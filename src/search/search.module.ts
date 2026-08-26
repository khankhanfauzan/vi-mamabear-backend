import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { ProductUtilsModule } from '@/product-utils/product-utils.module';

@Module({
  imports: [ProductUtilsModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
