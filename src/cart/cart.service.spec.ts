import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { PinoLogger } from 'pino-nestjs';

describe('CartService', () => {
  let service: CartService;

  const mockCartRepo = {
    findCartByUser: jest.fn(),
    findCartBySession: jest.fn(),
    findCartWithItems: jest.fn(),
  };

  const mockPrisma = {
    productVariant: { findUnique: jest.fn() },
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: CartRepository, useValue: mockCartRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCartTotals', () => {
    it('returns zeroed totals when the cart has no items', async () => {
      mockCartRepo.findCartWithItems.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });

      const result = await service.getCartTotals('user-1');

      expect(result).toEqual({ itemCount: 0, subtotal: 0, total: 0 });
    });

    it('returns zeroed totals when there is no cart at all', async () => {
      mockCartRepo.findCartWithItems.mockResolvedValue(null);

      const result = await service.getCartTotals('user-1');

      expect(result).toEqual({ itemCount: 0, subtotal: 0, total: 0 });
    });

    it('sums quantity and price across all cart items', async () => {
      mockCartRepo.findCartWithItems.mockResolvedValue({
        id: 'cart-1',
        items: [
          { quantity: 2, price: '10000', variant: { weightG: 100 } },
          { quantity: 1, price: '5000', variant: { weightG: 200 } },
        ],
      });

      const result = await service.getCartTotals('user-1');

      // itemCount = 2 + 1 = 3
      // subtotal = (2 * 10000) + (1 * 5000) = 25000
      expect(result).toEqual({ itemCount: 3, subtotal: 25000, total: 25000 });
    });
  });

  describe('addToCart', () => {
    it('throws BadRequestException when variantId is missing', async () => {
      mockCartRepo.findCartByUser.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });

      await expect(
        service.addToCart({ productId: 1, variantId: 0, quantity: 1 } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the variant does not exist', async () => {
      mockCartRepo.findCartByUser.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });
      mockPrisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(
        service.addToCart(
          { productId: 1, variantId: 99, quantity: 1 } as any,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when requested quantity exceeds stock', async () => {
      mockCartRepo.findCartByUser.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        id: 1,
        productId: 1,
        stock: 3,
        priceIdr: '10000',
        product: { id: 1, isActive: true },
      });

      await expect(
        service.addToCart(
          { productId: 1, variantId: 1, quantity: 10 } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
