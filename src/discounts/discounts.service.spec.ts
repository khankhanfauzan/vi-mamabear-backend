import { Test, TestingModule } from '@nestjs/testing';
import { DiscountsService } from './discounts.service';
import { DiscountsRepository } from './discounts.repository';

describe('DiscountsService', () => {
  let service: DiscountsService;

  const mockRepo = {
    create: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountsService,
        { provide: DiscountsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DiscountsService>(DiscountsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a discount and returns a success envelope', async () => {
      const dto = {
        variantId: 1,
        isPercent: true,
        amount: 10,
        startedAt: new Date('2026-01-01'),
        endsAt: new Date('2026-12-31'),
      } as any;
      const createdDiscount = { id: 1, ...dto };
      mockRepo.create.mockResolvedValue(createdDiscount);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        message: 'Discount created successfully',
        data: createdDiscount,
      });
    });
  });

  describe('remove', () => {
    it('deletes a discount and returns a success envelope with the id in the message', async () => {
      const deletedDiscount = { id: 5 };
      mockRepo.delete.mockResolvedValue(deletedDiscount);

      const result = await service.remove(5);

      expect(mockRepo.delete).toHaveBeenCalledWith(5);
      expect(result).toEqual({
        success: true,
        message: 'Discount 5 deleted successfully',
        data: deletedDiscount,
      });
    });
  });
});
