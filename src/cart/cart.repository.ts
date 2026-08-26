import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { PatchCourierDto } from './dto/patch-courier.dto';

// Keep includes minimal to reduce payload size (eager loading optimized)
const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: { id: true, name: true, isActive: true, images: true },
      },
      variant: {
        select: {
          id: true,
          name: true,
          priceIdr: true,
          stock: true,
          productId: true,
          weightG: true,
          images: true,
        },
      },
    },
  },
};

const CART_ITEM_WITH_CART_INCLUDE = {
  product: { select: { id: true, name: true, isActive: true } },
  variant: {
    select: { id: true, stock: true, productId: true, weightG: true },
  },
  cart: true,
};

type CacheEntry = { value: any; expiresAt: number };

@Injectable()
export class CartRepository {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private getTtlMs() {
    const v = process.env.CART_CACHE_TTL_MS;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 10000; // default 10s
  }

  private getFromCache(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCache(key: string, value: any) {
    this.cache.set(key, { value, expiresAt: Date.now() + this.getTtlMs() });
  }

  private invalidateCache(key: string) {
    this.cache.delete(key);
  }

  async findCartById(id: string) {
    const cached = this.getFromCache(id);
    if (cached) return cached;
    const cart = await this.prisma.cart.findUnique({
      where: { id },
      include: CART_INCLUDE,
    });
    if (cart) this.setCache(id, cart);
    return cart;
  }

  async findCartByUser(userId: string) {
    // We can't key cache by userId reliably, so fetch and cache by cart id
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: CART_INCLUDE,
    });
    if (cart) this.setCache(cart.id, cart);
    return cart;
  }

  async findCartBySession(sessionId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { sessionId },
      include: CART_INCLUDE,
    });
    if (cart) this.setCache(cart.id, cart);
    return cart;
  }

  async createCart(data: {
    userId?: string | null;
    sessionId?: string | null;
    expiresAt?: Date;
  }) {
    const cart = await this.prisma.cart.create({ data, include: CART_INCLUDE });
    if (cart) this.setCache(cart.id, cart);
    return cart;
  }

  async findCartWithItems(userId?: string, sessionId?: string) {
    if (userId) {
      const userCart = await this.findCartByUser(userId);
      if (userCart) return userCart;
    }

    if (sessionId) {
      return this.findCartBySession(sessionId);
    }

    return null;
  }

  async upsertCartItem(data: {
    cartId: string;
    productId: number;
    variantId: number;
    quantity?: number;
    price: any;
    increment?: boolean;
  }) {
    const variantId = data.variantId ?? null;
    const where = {
      cartId_productId_variantId: {
        cartId: data.cartId,
        productId: data.productId,
        variantId: variantId as number | null,
      },
    };

    const update = data.increment
      ? { quantity: { increment: data.quantity ?? 1 } }
      : { quantity: data.quantity };

    const result = await this.prisma.cartItem.upsert({
      where: where as any,
      update,
      create: {
        cartId: data.cartId,
        productId: data.productId,
        variantId: variantId,
        quantity: data.quantity ?? 1,
        price: data.price,
      },
    });

    // Invalidate cache for this cart
    this.invalidateCache(data.cartId);
    return result;
  }

  async recalculateCartTotals(cartId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      select: { quantity: true, price: true },
    });

    const subtotalIdr = items.reduce(
      (sum, item) => sum + item.quantity * Number(item.price),
      0,
    );

    const TAX_RATE = 0.11;
    const taxIdr = Math.round(subtotalIdr * TAX_RATE);

    const updated = await this.prisma.cart.update({
      where: { id: cartId },
      data: { subtotalIdr: Math.round(subtotalIdr), taxIdr },
    });

    this.invalidateCache(cartId);
    return updated;
  }

  async findCartItemById(id: string) {
    return this.prisma.cartItem.findUnique({
      where: { id },
      include: CART_ITEM_WITH_CART_INCLUDE,
    });
  }

  async updateCartItemQuantity(itemsId: string, quantity: number) {
    // Need to find cartId to invalidate cache after update
    const existing = await this.prisma.cartItem.findUnique({
      where: { id: itemsId },
      select: { cartId: true },
    });
    const result = await this.prisma.cartItem.update({
      where: { id: itemsId },
      data: { quantity },
    });
    if (existing?.cartId) this.invalidateCache(existing.cartId);
    return result;
  }

  async deleteCartItem(itemsId: string) {
    const existing = await this.prisma.cartItem.findUnique({
      where: { id: itemsId },
      select: { cartId: true },
    });
    const result = await this.prisma.cartItem.delete({
      where: { id: itemsId },
    });
    if (existing?.cartId) this.invalidateCache(existing.cartId);
    return result;
  }

  async deleteCartItems(cartId: string) {
    const result = await this.prisma.cartItem.deleteMany({ where: { cartId } });
    this.invalidateCache(cartId);
    return result;
  }

  async deleteCart(cartId: string) {
    const result = await this.prisma.cart.delete({ where: { id: cartId } });
    this.invalidateCache(cartId);
    return result;
  }

  async findExpiredCarts() {
    return this.prisma.cart.findMany({
      where: { expiresAt: { lt: new Date() } },
      include: { items: true },
    });
  }

  async deleteExpiredCarts() {
    return this.prisma.cart.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // Additional helpers for deduplication and optimization
  async findCartItemsByCart(cartId: string) {
    return this.prisma.cartItem.findMany({
      where: { cartId },
      select: { id: true, productId: true, variantId: true, quantity: true },
    });
  }

  clearCourierInformation(cartId: string) {
    return this.prisma.cart.update({
      where: { id: cartId },
      data: {
        shippingCostIdr: 0,
        courierCode: null,
        courierName: null,
        shippingMethod: null,
      },
    });
  }
  async updateCourierInformation(cartId: string, dto: PatchCourierDto) {
    return this.prisma.cart.update({
      where: { id: cartId },
      data: {
        shippingCostIdr: dto.shippingCostIdr,
        courierCode: dto.courierCode,
        courierName: dto.courierName,
        shippingMethod: dto.shippingMethod,
      },
    });
  }

  // Consolidate duplicate cart items (group by productId+variantId)
  async deduplicateCart(cartId: string) {
    const items = await this.findCartItemsByCart(cartId);
    const groups = new Map<
      string,
      {
        ids: string[];
        quantity: number;
        productId: number;
        variantId: number | null;
      }
    >();

    for (const it of items) {
      const key = `${it.productId}:${it.variantId ?? 'null'}`;
      const g = groups.get(key) || {
        ids: [],
        quantity: 0,
        productId: it.productId,
        variantId: it.variantId,
      };
      g.ids.push(it.id);
      g.quantity += it.quantity;
      groups.set(key, g);
    }

    let hasActions = false;

    await this.prisma.$transaction(async (tx) => {
      for (const [, g] of groups) {
        if (g.ids.length <= 1) continue;
        const [keepId, ...removeIds] = g.ids;
        await tx.cartItem.update({
          where: { id: keepId },
          data: { quantity: g.quantity },
        });
        await tx.cartItem.deleteMany({ where: { id: { in: removeIds } } });
        hasActions = true;
      }
    });

    if (hasActions) this.invalidateCache(cartId);
    return true;
  }
}
