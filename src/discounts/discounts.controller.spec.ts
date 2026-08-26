import { Test, TestingModule } from '@nestjs/testing';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';

describe('DiscountsController', () => {
  let controller: DiscountsController;

  const mockService = {
    create: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscountsController],
      providers: [{ provide: DiscountsService, useValue: mockService }],
    }).compile();

    controller = module.get<DiscountsController>(DiscountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
