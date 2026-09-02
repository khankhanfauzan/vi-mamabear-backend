import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { AddToCartDto } from './dto/add-to-cart-dto';
import { CartRepository } from './cart.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { PatchCourierDto } from './dto/patch-courier.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepo: CartRepository,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CartService.name);
  }

  // Get or Create Cart
  async getOrCreateCart(userId?: string, sessionId?: string) {
    let cart: Awaited<ReturnType<typeof this.cartRepo.findCartByUser>> = null;

    if (userId) {
      cart = await this.cartRepo.findCartByUser(userId);
    }

    if (!cart && sessionId && !userId) {
      cart = await this.cartRepo.findCartBySession(sessionId);
    }

    if (cart) return { cart, createdSessionId: undefined };

    const data: {
      userId?: string | null;
      sessionId?: string | null;
      expiresAt?: Date;
    } = {};

    let createdSessionId: string | undefined;

    // For authenticated users, only set userId (no sessionId)
    // For guests, set sessionId
    if (userId) {
      data.userId = userId;
      // Optionally set expiresAt for user carts too
      data.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (sessionId) {
      data.sessionId = sessionId;
      data.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else {
      createdSessionId = randomUUID();
      data.sessionId = createdSessionId;
      data.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const newCart = await this.cartRepo.createCart(data);
    return { cart: newCart, createdSessionId };
  }

  // Add Item to Cart
  async addToCart(dto: AddToCartDto, userId?: string, sessionId?: string) {
    try {
      const { cart, createdSessionId } = await this.getOrCreateCart(
        userId,
        sessionId,
      );

      // Variants are required for pricing - products don't have base prices
      if (!dto.variantId) {
        throw new BadRequestException('Variant ID is required for pricing');
      }

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
        include: { product: true }, // Include product to validate it exists
      });

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }

      // Ensure product exists and is available
      if (!variant.product || !variant.product.isActive) {
        throw new BadRequestException('Product is not available');
      }

      // Verify variant belongs to provided productId (if provided)
      if (dto.productId && dto.productId !== variant.productId) {
        throw new BadRequestException(
          'Variant does not belong to the specified product',
        );
      }

      // Check stock availability
      const requestedQuantity = dto.quantity ?? 1;
      if (requestedQuantity < 1) {
        throw new BadRequestException('Quantity must be at least 1');
      }
      if (requestedQuantity > variant.stock) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${variant.stock}, Requested: ${requestedQuantity}`,
        );
      }

      const result = await this.cartRepo.upsertCartItem({
        cartId: cart.id,
        productId: variant.productId,
        variantId: variant.id,
        quantity: requestedQuantity,
        price: variant.priceIdr,
        increment: true,
      });

      await this.cartRepo.recalculateCartTotals(cart.id);

      this.logger.info({
        message: 'Item added to cart',
        cartId: cart.id,
        productId: variant.productId,
        variantId: variant.id,
        quantity: requestedQuantity,
        status: 'success',
      });

      // Return the DB result and newly created sessionId (if any) so controller can set cookie
      return { result, createdSessionId };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to add item to cart',
        variantId: dto.variantId,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  // Update Quantity
  async updateItemQuantity(
    itemId: string,
    quantity: number,
    userId?: string,
    sessionId?: string,
  ) {
    try {
      if (quantity <= 0) {
        return this.removeItem(itemId, userId, sessionId);
      }

      const cartItem = await this.cartRepo.findCartItemById(itemId);

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      if (userId && cartItem.cart.userId !== userId) {
        throw new BadRequestException('Cart item does not belong to user');
      }
      if (sessionId && cartItem.cart.sessionId !== sessionId) {
        throw new BadRequestException('Cart item does not belong to session');
      }

      // Ensure product is still available
      if (cartItem.product && !cartItem.product.isActive) {
        throw new BadRequestException('Product is not available');
      }

      if (cartItem.variant && quantity > cartItem.variant.stock) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${cartItem.variant.stock}, Requested: ${quantity}`,
        );
      }

      const result = await this.cartRepo.updateCartItemQuantity(
        itemId,
        quantity,
      );

      await this.cartRepo.recalculateCartTotals(cartItem.cart.id);
      this.logger.info({
        message: 'Cart item quantity updated',
        itemId,
        quantity,
        status: 'success',
      });

      return result;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to update cart item quantity',
        itemId,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  // Validate entire cart before checkout
  async validateCartForCheckout(userId?: string, sessionId?: string) {
    const cart = await this.cartRepo.findCartWithItems(userId, sessionId);
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const issues: string[] = [];

    for (const item of cart.items || []) {
      // Product availability
      if (!item.product || !item.product.isActive) {
        issues.push(`Product ${item.productId} is not available`);
        continue;
      }

      // Variant existence
      if (item.variantId == null || !item.variant) {
        issues.push(
          `Variant ${item.variantId ?? 'null'} not found for product ${item.productId}`,
        );
        continue;
      }

      // Variant compatibility
      if (item.variant.productId !== item.productId) {
        issues.push(
          `Variant ${item.variantId} does not belong to product ${item.productId}`,
        );
      }

      // Quantity checks
      if (item.quantity < 1) {
        issues.push(`Item ${item.id} has invalid quantity ${item.quantity}`);
      }

      if (item.quantity > item.variant.stock) {
        issues.push(
          `Insufficient stock for variant ${item.variantId}. Available: ${item.variant.stock}, Requested: ${item.quantity}`,
        );
      }
    }

    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Cart validation failed',
        issues,
      });
    }

    return { valid: true };
  }

  // Remove Item
  async removeItem(itemsId: string, userId?: string, sessionId?: string) {
    try {
      const cartItem = await this.cartRepo.findCartItemById(itemsId);

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      if (userId && cartItem.cart.userId !== userId) {
        throw new BadRequestException('Cart item does not belong to user');
      }
      if (sessionId && cartItem.cart.sessionId !== sessionId) {
        throw new BadRequestException('Cart item does not belong to session');
      }

      const result = await this.cartRepo.deleteCartItem(itemsId);
      await this.cartRepo.recalculateCartTotals(cartItem.cart.id);
      this.logger.info({
        message: 'Cart item removed',
        itemId: itemsId,
        status: 'success',
      });
      return result;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to remove cart item',
        itemId: itemsId,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  // Clear Cart
  async clearCart(cartId: string) {
    try {
      const result = await this.cartRepo.deleteCartItems(cartId);
      await this.cartRepo.recalculateCartTotals(cartId);
      this.logger.info({
        message: 'Cart cleared',
        cartId,
        status: 'success',
      });
      return result;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to clear cart',
        cartId,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  // Get Full Cart (with relations)
  async getCart(userId?: string, sessionId?: string) {
    const result = await this.cartRepo.findCartWithItems(userId, sessionId);
    if (!result) return null;
    const totalWeight = result?.items?.reduce((sum, item) => {
      const weight = item.variant?.weightG ?? 0;
      return sum + weight * item.quantity;
    }, 0);
    this.logger.info({
      message: 'Cart retrieved',
      userId: userId || 'guest',
      sessionId: sessionId || 'null',
      itemCount: result?.items?.length || 0,
      totalWeight: totalWeight || 0,
      status: 'success',
    });
    return {
      ...result,
      totalWeight,
    };
  }

  // Merge Guest Cart → User Cart
  async mergeCart(userId: string, sessionId: string) {
    try {
      const guestCart = await this.cartRepo.findCartBySession(sessionId);

      if (!guestCart) return null;

      const { cart: userCart } = await this.getOrCreateCart(userId);

      for (const item of guestCart.items) {
        await this.cartRepo.upsertCartItem({
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
          increment: true,
        });
      }

      await this.cartRepo.deleteCart(guestCart.id);

      // Ensure no duplicate items remain after merge
      await this.cartRepo.deduplicateCart(userCart.id);

      this.logger.info({
        message: 'Cart merged successfully',
        userId,
        guestCartId: guestCart.id,
        userCartId: userCart.id,
        itemCount: guestCart.items.length,
        status: 'success',
      });

      return userCart;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to merge cart',
        userId,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  // Get Cart Totals
  async getCartTotals(userId?: string, sessionId?: string) {
    const cart = await this.getCart(userId, sessionId);

    if (!cart || !cart.items || cart.items.length === 0) {
      return {
        itemCount: 0,
        subtotal: 0,
        total: 0,
      };
    }

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (Number(item.price) * item.quantity),
      0,
    );

    // For now, assuming no tax or shipping - extend as needed
    const total = subtotal;

    return {
      itemCount,
      subtotal: Number(subtotal.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  async clearCourierInformation(cartId: string) {
    return this.cartRepo.clearCourierInformation(cartId);
  }

  async updateCourierInformation(cartId: string, dto: PatchCourierDto) {
    return this.cartRepo.updateCourierInformation(cartId, dto);
  }

  // Cleanup Expired Carts (for cron)
  async cleanupExpiredCarts() {
    return this.cartRepo.deleteExpiredCarts();
  }
}
