import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockRepo = {
    getOrderCount: jest.fn(),
    getCustomerCount: jest.fn(),
    getProductCount: jest.fn(),
    getRecentOrder: jest.fn(),
    getLowStockProducts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
