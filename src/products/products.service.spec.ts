import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { PinoLogger } from 'pino-nestjs';
import { CursorPaginationService } from '@/common/services/pagination.service';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockRepo = {};
  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const mockPagination = { paginate: jest.fn() };
  const mockCloudinary = {
    uploadFile: jest.fn(),
    uploadMultiple: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: mockRepo },
        { provide: PinoLogger, useValue: mockLogger },
        { provide: CursorPaginationService, useValue: mockPagination },
        { provide: CloudinaryService, useValue: mockCloudinary },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
