import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ReviewsService } from '@/reviews/reviews.service';
import { CreateReviewDto } from '@/reviews/dto/create-review.dto';
import { CursorPaginationRequestDto } from '@/common/dto/request/pagination.request.dto';
import { VariantService } from '@/variant/variant.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { SearchRequestDto } from '@/search/dto/search-request.dto';
import { SearchService } from '@/search/search.service';
import { SearchAutocompleteOptionsDto } from '@/search/dto/search-autocomplete-options.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { ReviewPaginationDto } from '@/reviews/dto/review-pagination.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewsService: ReviewsService,
    private readonly variantService: VariantService,
    private readonly searchService: SearchService,
  ) {}

  @Get()
  findAll(@Query() paginationDto: CursorPaginationRequestDto) {
    return this.productsService.findAll(paginationDto);
  }

  @Get('search')
  searchForProducts(@Query() query: SearchRequestDto) {
    return this.searchService.findProductsMatchingQuery(query);
  }

  @Get('filter')
  filterProducts(@Query() query: FilterProductsDto) {
    return this.productsService.findProductsWithFilter(query);
  }
  @Get('search/suggestions')
  suggestAutocomplete(
    @Query() query: SearchRequestDto,
    @Query() options?: SearchAutocompleteOptionsDto,
  ) {
    return this.searchService.getFuzzyAutocompleteResults(query, options);
  }

  @Get(':slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':slug/related')
  findRelatedProductsBySlug(@Param('slug') slug: string) {
    return this.productsService.findRelatedProducts(slug);
  }

  @Get(':slug/variants')
  getProductVariantBySlug(@Param('slug') slug: string) {
    return this.variantService.getProductVariantBySlug(slug);
  }

  @Get(':slug/reviews')
  findAllReviewsOfProductBySlug(
    @Param('slug') slug: string,
    @Query() paginationDto: ReviewPaginationDto,
  ) {
    return this.reviewsService.findReviewsOfProductBySlug(slug, paginationDto);
  }
  @Get(':slug/reviews/summary')
  getReviewSummaryOfProductWithSlug(@Param('slug') slug: string) {
    return this.reviewsService.getReviewSummaryOfProductWithSlug(slug);
  }

  @UseGuards(new JwtAuthGuard())
  @ApiBearerAuth('JwtAuthGuard')
  @Post(':slug/reviews')
  createReviewForProduct(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReviewForProductWithSlug(slug, dto);
  }

  @UseGuards(new JwtAuthGuard())
  @ApiBearerAuth('JwtAuthGuard')
  @Patch(':slug/reviews/:reviewId/upvote')
  upvoteReviewOfProduct(@Param('reviewId') reviewId: number) {
    return this.reviewsService.upvoteReviewWithId(reviewId);
  }
}
