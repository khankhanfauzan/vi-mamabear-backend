import { Order, Prisma, Role } from '@/generated/prisma';
import { startOfDay, endOfDay } from '@/common/utils/date.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderRepository } from './order.repository';
import { ServiceResult } from '@/common/ServiceResult';
import { OrderStatus } from '@/generated/prisma';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { MailService } from '@/auth/mail.service';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { InvoicePaymentStatus, InvoiceStructure } from '@/types/invoice.type';
import {
  PagePaginationResponseDto,
  PagePaginationMetaDto,
} from '@/common/dto/response/page-pagination.response.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly mailService: MailService,
  ) {}

  async createOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<ServiceResult<Order>> {
    const user = await this.repo.findUser(userId);
    if (!user) throw new NotFoundException('User not found');

    const order = await this.repo.createOrder(userId, dto);
    this.mailService.orderConfirmationEmail(user.email, order.id)
      .catch(() => {});
    return {
      success: true,
      message: `Order ${order.id} created successfully`,
      data: order,
    };
  }

  async getOrderById(
    userId: string,
    orderId: string,
  ): Promise<ServiceResult<Order>> {
    const order = await this.repo.findOne(userId, orderId);
    if (!order)
      throw new NotFoundException(`Order with id ${orderId} not found`);
    return {
      success: true,
      message: 'Order found',
      data: order,
    };
  }

  async getOrderByIdForAdmin(orderId: string) {
    const order = await this.repo.findOneForAdmin(orderId);
    if (!order)
      throw new NotFoundException(`Order with id ${orderId} not found`);
    return {
      success: true,
      message: 'Order found',
      data: order,
    };
  }

  async getOrdersByUserId(userId: string, paginationDto: OrderPaginationDto) {
    const where: Prisma.OrderWhereInput = { userId };

    if (paginationDto.status) {
      where.status = paginationDto.status;
    }
    if (paginationDto.search) {
      const searchTerm = paginationDto.search;
      const { isUUID } = await import('class-validator');
      if (isUUID(searchTerm)) {
        where.OR = [
          { id: searchTerm },
          { notes: { contains: searchTerm, mode: 'insensitive' } },
        ];
      } else {
        where.notes = { contains: searchTerm, mode: 'insensitive' };
      }
    }
    if (paginationDto.startDate || paginationDto.endDate) {
      where.createdAt = {};
      if (paginationDto.startDate)
        where.createdAt.gte = startOfDay(paginationDto.startDate);
      if (paginationDto.endDate)
        where.createdAt.lte = endOfDay(paginationDto.endDate);
    }

    const limit = paginationDto.limit ?? 10;
    const orders = await this.repo.findMany({
      where,
      include: {
        orderItems: {
          include: {
            product: { select: { name: true, slug: true } },
            variant: {
              select: {
                name: true,
                priceIdr: true,
                images: { take: 1, select: { imageUrl: true, altText: true } },
              },
            },
          },
        },
        shippingAddress: true,
      },
      take: limit + 1,
      cursor: paginationDto.cursor ? { id: paginationDto.cursor } : undefined,
      skip: paginationDto.cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor: string | null = null;
    if (orders.length > limit) {
      orders.pop();
      nextCursor = orders[orders.length - 1]?.id ?? null;
    }

    return {
      success: true,
      data: orders,
      pagination: { limit, nextCursor, hasNextPage: nextCursor !== null },
    };
  }

  async cancelOrder(
    role: string,
    userId: string,
    orderId: string,
    reason?: string,
  ): Promise<ServiceResult<null>> {
    const order =
      role === Role.ADMIN || role === Role.SUPERADMIN
        ? await this.repo.findOneForAdmin(orderId)
        : await this.repo.findOne(userId, orderId);
    if (!order)
      throw new NotFoundException(`Order with id ${orderId} not found`);

    if (order.status !== OrderStatus.CONFIRMED && role === Role.USER)
      throw new BadRequestException('Cannot cancel order in current status');

    await this.repo.update({ id: orderId }, { status: OrderStatus.CANCELLED });
    await this.repo.createOrderStatusHistory(
      orderId,
      OrderStatus.CANCELLED,
      reason,
    );
    return {
      success: true,
      message: `Order ${orderId} cancelled`,
      data: null,
    };
  }

  async updateOrderStatus(
    userId: string,
    orderId: string,
    dto: UpdateOrderDto,
  ): Promise<ServiceResult<Order>> {
    const order = await this.repo.findOneForAdmin(orderId);
    if (!order)
      throw new NotFoundException(`Order with id ${orderId} not found`);

    const status = dto.status ?? order.status;
    const updatedOrder = await this.repo.update({ id: orderId }, { status });
    await this.repo.createOrderStatusHistory(orderId, status, dto.notes);
    return {
      success: true,
      message: `Order ${orderId} status updated to ${status}`,
      data: updatedOrder,
    };
  }

  async updateTrackingNumber(orderId: string, dto: UpdateTrackingDto) {
    const order = await this.repo.findOneForAdmin(orderId);
    if (!order)
      throw new NotFoundException(`Order with id ${orderId} not found`);

    const trackingNumber = dto.trackingNumber;

    return this.repo.update({ id: orderId }, { trackingNumber });
  }

  async getInvoice(
    userId: string,
    role: Role,
    orderId: string,
  ): Promise<InvoiceStructure> {
    const order =
      role === Role.ADMIN || role === Role.SUPERADMIN
        ? await this.repo.findOneForAdmin(orderId)
        : await this.repo.findOne(userId, orderId);

    if (!order)
      throw new NotFoundException(`Order with id ${orderId} not found`);

    const INVALID_STATUSES: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.RETURNED,
      OrderStatus.REFUNDED,
      OrderStatus.PAYMENT_FAILED,
    ];

    if (INVALID_STATUSES.includes(order.status))
      throw new BadRequestException(
        "Can't generate invoice in current order status",
      );

    const datePart = order.createdAt
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const invoicePaymentStatus =
      order.status === OrderStatus.PAYMENT_PAID
        ? InvoicePaymentStatus.PAID
        : InvoicePaymentStatus.UNPAID;

    return {
      invoiceNumber: `INV-${datePart}-${order.id.slice(0, 6).toUpperCase()}`,
      issuedAt: new Date(),
      OrderedItem: order.orderItems.map((item) => ({
        productName: item.product.name,
        variantName: item.variant.name,
        quantity: item.quantity,
        price: item.variant.priceIdr.toString(),
      })),
      ShippingAddress:
        order.shippingAddress?.completeAddress ?? 'Address not found',
      subtotalIdr: order.subtotalIdr.toString(),
      shippingCostIdr: order.shippingCostIdr.toString(),
      totalIdr: (order.subtotalIdr + order.shippingCostIdr).toString(),
      PaymentMethod: order.paymentMethod?.toUpperCase() ?? 'Method not found',
      InvoicePaymentStatus: invoicePaymentStatus,
    };
  }

  async findAllOrders(query: AdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, totalItems } = await this.repo.findAllOrders(query);
    const meta = new PagePaginationMetaDto(page, limit, totalItems);
    const result = new PagePaginationResponseDto(items, meta);
    return {
      success: true,
      message: `Returned ${items.length} orders (page ${page} of ${meta.totalPages})`,
      data: result,
    };
  }

  async exportOrdersCsv(query: AdminOrdersQueryDto): Promise<string> {
    const orders = await this.repo.exportOrders(query);

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      'Order ID',
      'Status',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Items',
      'Subtotal (IDR)',
      'Shipping Cost (IDR)',
      'Total (IDR)',
      'Payment Method',
      'Courier',
      'Tracking Number',
      'Shipping Address',
      'Created At',
    ].join(',');

    const rows = orders.map((o) => {
      const items = o.orderItems
        .map(
          (oi) =>
            `${oi.product.name} (${oi.variant.name}) x${oi.quantity}`,
        )
        .join('; ');

      const addr = o.shippingAddress
        ? [
            o.shippingAddress.name,
            o.shippingAddress.phone,
            o.shippingAddress.completeAddress,
          ]
            .filter(Boolean)
            .join(' - ')
        : '';

      return [
        escapeCsv(o.id),
        escapeCsv(o.status),
        escapeCsv(o.user.name),
        escapeCsv(o.user.email),
        escapeCsv(o.user.phone),
        escapeCsv(items),
        escapeCsv(o.subtotalIdr),
        escapeCsv(o.shippingCostIdr),
        escapeCsv(o.subtotalIdr + o.shippingCostIdr),
        escapeCsv(o.paymentMethod),
        escapeCsv(o.courierName),
        escapeCsv(o.trackingNumber),
        escapeCsv(addr),
        escapeCsv(o.createdAt.toISOString()),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  async exportOrders(): Promise<ServiceResult<any>> {
    const orders = await this.repo.findAllForExport();

    const rows = orders.map((order) => ({
      //No detail for product and variant for now
      OrderId: order.id,
      OrderDate: order.createdAt.toISOString(),
      LastUpdate: order.updatedAt.toISOString(),
      OrderStatus: order.status,
      UserId: order.user.id,
      UserName: order.user.name,
      UserEmail: order.user.email,
      UserPhoneNumber: order.user.phone,
      SubtotalIdr: order.subtotalIdr,
      ShippingAddress: order.shippingAddress?.completeAddress,
      ShippingCostIdr: order.shippingCostIdr,
      CourierName: order.courierName,
      CourierCode: order.courierCode,
      shippingMethod: order.shippingMethod,
      TrackingNumber: order.trackingNumber,
      PaymentMethod: order.paymentMethod,
    }));

    return {
      success: true,
      message: 'Orders exported successfully',
      data: rows,
    };
  }
}
