import { OrderService } from './order.service';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CancelOrderDto } from './dto/cancel-order-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { RolesGuard } from '@/auth/guard/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { format } from '@fast-csv/format';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { Response } from 'express';
import { AdminActivityLogService } from '@/activity-log/admin-activity-log.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('order (admin)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.ADMIN, Role.SUPERADMIN])
@Controller('admin/order')
@ApiBearerAuth('JwtAuthGuard')
export class OrderAdminController {
  constructor(
    private readonly orderService: OrderService,
    private readonly activityLogService: AdminActivityLogService,
  ) {}

  @Get(':id/invoice')
  getInvoice(@Req() req: any, @Param('id') id: string) {
    return this.orderService.getInvoice(req.user.sub, req.user.role, id);
  }

  @Get('export')
  async exportOrders(@Res() res: Response) {
    const result = await this.orderService.exportOrders();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');

    const csvStream = format({
      headers: [
        'Order ID',
        'Order Date',
        'Last Updated',
        'Order Status',
        'User ID',
        'User Name',
        'User Email',
        'User Phone Number',
        'Subtotal IDR',
        'Shipping Address',
        'Shipping Cost',
        'Courier Name',
        'Courier Code',
        'Shipping Method',
        'Tracking Number',
        'Payment Method',
      ],
    });

    csvStream.pipe(res);

    result.data.forEach((order) => {
      csvStream.write({
        'Order ID': order.OrderId,
        'Order Date': order.OrderDate,
        'Last Updated': order.LastUpdate,
        'Order Status': order.OrderStatus,
        'User ID': order.UserId,
        'User Name': order.UserName,
        'User Email': order.UserEmail,
        'User Phone Number': order.UserPhoneNumber,
        'Subtotal IDR': order.SubtotalIdr,
        'Shipping Address': order.ShippingAddress,
        'Shipping Cost': order.ShippingCostIdr,
        'Courier Name': order.CourierName,
        'Courier Code': order.CourierCode,
        'Shipping Method': order.shippingMethod,
        'Tracking Number': order.TrackingNumber,
        'Payment Method': order.PaymentMethod,
      });
    });

    csvStream.end();
  }

  @Get()
  findAllOrders(@Query() query: AdminOrdersQueryDto) {
    return this.orderService.findAllOrders(query);
  }

  @Get(':id')
  findOrderById(@Param('id') id: string) {
    return this.orderService.getOrderByIdForAdmin(id);
  }

  @Post(':id/cancel')
  async cancelOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const result = await this.orderService.cancelOrder(
      req.user.role,
      req.user.sub,
      id,
      dto.reason,
    );
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'CANCEL', 'Order', id);
    }
    return result;
  }

  @Patch(':id/status')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    const result = await this.orderService.updateOrderStatus(
      req.user.sub,
      id,
      updateOrderDto,
    );
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'UPDATE_STATUS', 'Order', id);
    }
    return result;
  }

  @Patch(':id/tracking')
  async updateTrackingNumber(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateTrackingDto: UpdateTrackingDto,
  ) {
    const result = await this.orderService.updateTrackingNumber(id, updateTrackingDto);
    this.activityLogService.log(req.user.sub, 'UPDATE_TRACKING', 'Order', id);
    return result;
  }
}
