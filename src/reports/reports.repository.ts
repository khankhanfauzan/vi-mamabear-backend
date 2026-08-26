import { Role, OrderStatus } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';
import { startOfDay, endOfDay } from '@/common/utils/date.util';
import { Injectable } from '@nestjs/common';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getOrderCount() {
    return this.prisma.order.count();
  }

  getCustomerCount() {
    return this.prisma.user.count({
      where: {
        role: Role.USER,
      },
    });
  }

  getProductCount() {
    return this.prisma.product.count({
      where: {
        isActive: true,
      },
    });
  }

  getRecentOrder() {
    return this.prisma.order.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        orderItems: {
          select: {
            product: {
              select: {
                name: true,
              },
            },
            variant: {
              select: {
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
  }

  getLowStockProducts() {
    return this.prisma.productVariant.findMany({
      where: {
        stock: {
          lte: 100,
        },
      },
      take: 10,
      orderBy: {
        stock: 'asc',
      },
      select: {
        name: true,
        stock: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  getTopSellingProducts() {
    return this.prisma.product.findMany({
      take: 10,
      orderBy: {
        totalSold: 'desc',
      },
      select: {
        name: true,
        totalSold: true,
        variants: {
          select: {
            name: true,
            priceIdr: true,
          },
        },
      },
    });
  }

  getRevenueOrders() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.PAYMENT_PAID,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSED,
            OrderStatus.SENDING,
            OrderStatus.RECEIVED,
            OrderStatus.COMPLETED,
          ],
        },
      },

      select: {
        subtotalIdr: true,
        taxIdr: true,
        shippingCostIdr: true,
      },
    });
  }

  async getSalesOrders(query: SalesReportQueryDto) {
    return this.prisma.order.findMany({
      where: {
        status: query.status,

        createdAt: {
          gte: query.startDate ? startOfDay(query.startDate) : undefined,

          lte: query.endDate ? endOfDay(query.endDate) : undefined,
        },

        orderItems: {
          some: {
            productId: query.productId,

            product: {
              categoryId: query.categoryId,
            },
          },
        },
      },

      include: {
        orderItems: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }

  async getProductPerformance(query: SalesReportQueryDto) {
    return this.prisma.orderItem.findMany({
      where: {
        order: {
          status: query.status,

          createdAt: {
            gte: query.startDate ? startOfDay(query.startDate) : undefined,

            lte: query.endDate ? endOfDay(query.endDate) : undefined,
          },
        },

        productId: query.productId,

        product: {
          categoryId: query.categoryId,
        },
      },

      include: {
        product: {
          include: {
            category: true,
          },
        },

        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },

        order: true,
      },
    });
  }
}
