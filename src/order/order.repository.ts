import { OrderStatus, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';
import { startOfDay, endOfDay } from '@/common/utils/date.util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  AdminOrdersQueryDto,
  AdminOrderSortBy,
  AdminOrderSortOrder,
} from './dto/admin-orders-query.dto';
import { isUUID } from 'class-validator';

const ORDERITEM_SELECT = {
  id: true,
  productId: true,
  variantId: true,
  quantity: true,
  product: { select: { name: true, slug: true } },
  variant: {
    select: {
      name: true,
      stock: true,
      priceIdr: true,
      images: {
        take: 1,
        select: { imageUrl: true, altText: true },
      },
    },
  },
};

const ORDER_INCLUDE = {
  shippingAddress: true,
  orderItems: { select: ORDERITEM_SELECT },
};

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  createOrder(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: dto.cartId },
        include: {
          items: {
            include: {
              variant: true,
              product: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
      });
      if (!cart)
        throw new UnprocessableEntityException(
          `Cart with id ${dto.cartId} does not exist!`,
        );
      if (cart.userId && cart.userId !== userId)
        throw new ForbiddenException(
          'Cart does not belong to the authenticated user',
        );
      if (cart.items.length <= 0)
        throw new UnprocessableEntityException(
          `Cart with id ${dto.cartId} does not contain any items`,
        );

      const address = await tx.address.findFirst({
        where: { id: dto.addressId, userId },
      });
      if (!address)
        throw new UnprocessableEntityException(
          `Address with id ${dto.addressId} does not exist or does not belong to user!`,
        );

      const order = await tx.order.create({
        data: {
          userId,
          notes: dto.notes,
          subtotalIdr: cart.subtotalIdr,
          taxIdr: cart.taxIdr,
          shippingCostIdr: cart.shippingCostIdr,
          grandTotalIdr: cart.subtotalIdr + cart.taxIdr + cart.shippingCostIdr,
          courierName: cart.courierName,
          courierCode: cart.courierCode,
          shippingMethod: cart.shippingMethod,
          status: OrderStatus.PAYMENT_PENDING,
          orderItems: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          shippingAddress: {
            create: {
              name: address.name,
              phone: address.phone,
              provinceId: address.provinceId,
              provinceName: address.provinceName,
              cityId: address.cityId,
              cityName: address.cityName,
              districtId: address.districtId,
              districtName: address.districtName,
              subdistrictId: address.subdistrictId,
              subdistrictName: address.subdistrictName,
              postalCode: address.postalCode,
              road: address.road,
              completeAddress: address.completeAddress,
              detail: address.detail,
              usedFor: address.usedFor,
            },
          },
          orderStatusHistory: {
            create: {
              status: OrderStatus.PAYMENT_PENDING,
            },
          },
        },
        include: ORDER_INCLUDE,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.delete({ where: { id: cart.id } });

      return order;
    });
  }

  update(where: Prisma.OrderWhereUniqueInput, data: Prisma.OrderUpdateInput) {
    return this.prisma.order.update({
      where,
      data,
    });
  }

  findOne(userId: string, orderId: string) {
    return this.prisma.order.findFirst({
      where: {
        userId,
        id: orderId,
      },
      include: {
        ...ORDER_INCLUDE,
        shippingAddress: true,
        orderStatusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }
  findById(orderId: string) {
      return this.prisma.order.findUnique({
          where: { id: orderId },
      });
  }

  handleCompleteOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      if (!isUUID(orderId))
        throw new UnprocessableEntityException(
          `Order id='${orderId}' must be in the form of UUID`,
        );
      const resolvedOrder = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (!resolvedOrder)
        throw new UnprocessableEntityException(
          `Cannot process product sold increment: order with orderId=${orderId} does not exist`,
        );
      if (resolvedOrder.status != OrderStatus.PAYMENT_PENDING)
          throw new BadRequestException(`Cannot update status of order ${orderId}, order does not have PAYMENT_PENDING status`);
      const order = await tx.order.update({
        where: { id: resolvedOrder.id },
        data: { status: OrderStatus.PAYMENT_PAID },
        include: { orderItems: { select: ORDERITEM_SELECT } },
      });
      if (order.orderItems.length <= 0)
        throw new UnprocessableEntityException(
          `Cannot process product sold increment: order with orderId=${orderId} has no order items`,
        );
      return order.orderItems.forEach(async (item) => {
        const currentVariant = await tx.productVariant.findUnique({
          where: {
            id: item.variantId,
            productId: item.productId,
          },
          select: { stock: true },
        });
        if (!currentVariant)
          throw new BadRequestException(
            `orderItems forEach: Variant variantId=${item.variantId} of Product productId=${item.productId} does not exist`,
          );
        if (currentVariant.stock < item.quantity)
          throw new BadRequestException(
            `orderItems forEach: Cannot decrement stock of variantId=${item.variantId} by ${item.quantity} (quantity must be less than ${currentVariant.stock})`,
          );
        const product = await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            totalSold: {
              increment: item.quantity,
            },
          },
        });
        const variant = this.prisma.productVariant.update({
          where: {
            id: item.variantId,
            productId: product.id,
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
        return variant;
      });
    });
  }

  findOneForAdmin(orderId: string) {
    return this.prisma.order.findFirst({
      where: {
        id: orderId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  take: 1,
                  select: { imageUrl: true, altText: true },
                },
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                priceIdr: true,
                stock: true,
                sku: true,
                weightG: true,
              },
            },
          },
        },
        shippingAddress: true,
        orderStatusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  findAddressById(userId: string, addressId: number) {
    return this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });
  }

  findMany(args: Prisma.OrderFindManyArgs) {
    return this.prisma.order.findMany(args);
  }

  findUser(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
  }

  findCartByUserId(userId: string) {
    return this.prisma.cart.findFirst({
      where: {
        userId,
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                discount: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  createOrderStatusHistory(
    orderId: string,
    status: OrderStatus,
    notes?: string,
  ) {
    return this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status,
        notes,
      },
    });
  }

  findOrderForInvoice(orderId: string) {
    return this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        shippingAddress: true,
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
                weightG: true,
                priceIdr: true,
              },
            },
          },
        },
      },
    });
  }

  async findAllOrders(query: AdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentMethod) {
      where.paymentMethod = { contains: query.paymentMethod, mode: 'insensitive' };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = startOfDay(query.startDate);
      if (query.endDate) where.createdAt.lte = endOfDay(query.endDate);
    }

    if (query.search) {
      const searchTerm = query.search;
      const isSearchUUID = isUUID(searchTerm);
      where.OR = [
        ...(isSearchUUID ? [{ id: searchTerm }] : []),
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const dir = query.sortOrder === AdminOrderSortOrder.ASC ? 'asc' : 'desc';

    let orderBy: Prisma.OrderOrderByWithRelationInput;
    switch (query.sortBy) {
      case AdminOrderSortBy.STATUS:
        orderBy = { status: dir };
        break;
      case AdminOrderSortBy.TOTAL:
        orderBy = { subtotalIdr: dir };
        break;
      default:
        orderBy = { createdAt: dir };
        break;
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: {
                    take: 1,
                    select: { imageUrl: true, altText: true },
                  },
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  priceIdr: true,
                  stock: true,
                  sku: true,
                },
              },
            },
          },
          shippingAddress: true,
          orderStatusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, totalItems };
  }

  async exportOrders(query: AdminOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        (where.createdAt as any).gte = startOfDay(query.startDate);
      }
      if (query.endDate) {
        (where.createdAt as any).lte = endOfDay(query.endDate);
      }
    }
    if (query.search) {
      const searchTerm = query.search;
      where.OR = [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
        shippingAddress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllForExport() {
    return this.prisma.order.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        subtotalIdr: true,
        shippingAddress: {
          select: {
            completeAddress: true,
            detail: true,
          },
        },
        shippingCostIdr: true,
        courierName: true,
        courierCode: true,
        shippingMethod: true,
        trackingNumber: true,
        paymentMethod: true,
      },
    });
  }
}
