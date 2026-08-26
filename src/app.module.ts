import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomLoggerModule } from './common/logger/logger.module';
import { MailHogOptions } from './options/mailhog.options';
import { CategoryModule } from './category/category.module';
import { UploadModule } from './upload/upload.module';
import { ReviewsModule } from './reviews/reviews.module';
import { HighlightsModule } from './highlights/highlights.module';
import { DiscountsModule } from './discounts/discounts.module';
import { VariantModule } from './variant/variant.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { SearchModule } from './search/search.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ProductUtilsModule } from './product-utils/product-utils.module';
import { SettingsModule } from './settings/settings.module';
import { CartModule } from './cart/cart.module';
import { CleanupService } from './scheduler/cleanup.service';
import { PaymentModule } from './payment/payment.module';
import { ShippingModule } from './shipping/shipping.module';
import { AddressesModule } from './addresses/addresses.module';
import { OrderModule } from './order/order.module';
import { ReportsModule } from './reports/reports.module';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CustomLoggerModule,
    CartModule,
    MailerModule.forRoot(MailHogOptions),
    PrismaModule,
    ProductsModule,
    UsersModule,
    AuthModule,
    HealthModule,
    CategoryModule,
    UploadModule,
    ReviewsModule,
    HighlightsModule,
    DiscountsModule,
    VariantModule,
    CloudinaryModule,
    SearchModule,
    EmbeddingsModule,
    ProductUtilsModule,
    PaymentModule,
    SettingsModule,
    ShippingModule,
    AddressesModule,
    OrderModule,
    ReportsModule,
    ActivityLogModule,
  ],
  controllers: [AppController],
  providers: [AppService, CleanupService],
})
export class AppModule {}
