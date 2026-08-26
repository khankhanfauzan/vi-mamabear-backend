import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { CancelOrderDto } from './dto/cancel-order-item.dto';
import { GetUserId } from '@/common/decorators/get-user-id-decorator';
import { PinoLogger } from 'pino-nestjs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('order')
@Controller('order')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JwtAuthGuard')
export class OrderController {
  constructor(
      private readonly orderService: OrderService,
      private readonly logger: PinoLogger,
  ) {}

  @Post(':id/cancel')
  cancelOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(
      req.user.role,
      req.user.sub,
      id,
      dto.reason,
    );
  }

  @Get(':id/invoice')
  getInvoice(@Req() req: any, @Param('id') id: string) {
    return this.orderService.getInvoice(req.user.sub, req.user.role, id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.orderService.getOrderById(req.user.sub, id);
  }

  @Get()
  findAll(@Req() req: any, @Query() paginationDto: OrderPaginationDto) {
    return this.orderService.getOrdersByUserId(req.user.sub, paginationDto);
  }

  // refactor below
  @Post() // on checkout
  createOrderAfterCheckout(
    @Req() req: any,
    @Body() dto: CreateOrderDto,
  ) {
    this.logger.info(`Creating order for user with id ${req.user.sub}`);
    return this.orderService.createOrder(req.user.sub, dto); // orderId as param for everything below
  }
}
