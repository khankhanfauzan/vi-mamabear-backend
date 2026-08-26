import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductUtils } from '@/product-utils/product-utils';

describe('SearchService', () => {
  let service: SearchService;

  const mockPrisma = {
    product: { findMany: jest.fn() },
    productVariant: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockProductUtils = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProductUtils, useValue: mockProductUtils },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
