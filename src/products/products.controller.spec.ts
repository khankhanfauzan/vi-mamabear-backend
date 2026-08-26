import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ReviewsService } from '@/reviews/reviews.service';
import { VariantService } from '@/variant/variant.service';
import { SearchService } from '@/search/search.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    findAll: jest.fn(),
    findProductsWithFilter: jest.fn(),
    findBySlug: jest.fn(),
    findRelatedProducts: jest.fn(),
  };
  const mockReviewsService = {
    findReviewsOfProductBySlug: jest.fn(),
    getReviewSummaryOfProductWithSlug: jest.fn(),
    createReviewForProductWithSlug: jest.fn(),
    upvoteReviewWithId: jest.fn(),
  };
  const mockVariantService = {
    getProductVariantBySlug: jest.fn(),
  };
  const mockSearchService = {
    findProductsMatchingQuery: jest.fn(),
    getFuzzyAutocompleteResults: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: VariantService, useValue: mockVariantService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
