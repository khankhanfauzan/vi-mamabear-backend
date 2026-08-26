import { Module } from '@nestjs/common';
import { ProductUtils } from './product-utils';

@Module({
    providers: [ProductUtils],
    exports: [ProductUtils],
})
export class ProductUtilsModule {}
