import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { CartRepository } from '@/cart/cart.repository';

describe('ShippingService', () => {
  let service: ShippingService;

  const mockCartRepository = {
    findCartByUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: CartRepository, useValue: mockCartRepository },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateWeight', () => {
    it('throws NotFoundException when the user has no cart', async () => {
      mockCartRepository.findCartByUser.mockResolvedValue(null);

      await expect(service.calculateWeight('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sums the weight of every item (variant weight * quantity)', async () => {
      mockCartRepository.findCartByUser.mockResolvedValue({
        items: [
          { variant: { weightG: 100 }, quantity: 2 },
          { variant: { weightG: 50 }, quantity: 3 },
        ],
      });

      const weight = await service.calculateWeight('user-1');

      // (100 * 2) + (50 * 3) = 350
      expect(weight).toBe(350);
    });

    it('treats items without a variant as zero weight', async () => {
      mockCartRepository.findCartByUser.mockResolvedValue({
        items: [{ variant: null, quantity: 5 }],
      });

      const weight = await service.calculateWeight('user-1');

      expect(weight).toBe(0);
    });

    it('defaults quantity to 1 when not provided', async () => {
      mockCartRepository.findCartByUser.mockResolvedValue({
        items: [{ variant: { weightG: 100 }, quantity: undefined }],
      });

      const weight = await service.calculateWeight('user-1');

      expect(weight).toBe(100);
    });
  });
});
