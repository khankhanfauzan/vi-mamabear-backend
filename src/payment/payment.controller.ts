import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { PinoLogger } from 'pino-nestjs';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('payment')
@Controller('payment')
@ApiBearerAuth('JwtAuthGuard')
export class PaymentController {
  constructor(
      private readonly paymentService: PaymentService,
      private readonly logger: PinoLogger,
  ) {}
  
  @UseGuards(JwtAuthGuard)
  @Post('create')
  createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
      return this.paymentService.createTransaction(req.user, dto);
  }
  @Post('notification')
  handleNotification(@Body() notification: any) {
      this.logger.info(`Processing inbound notification: ${notification}`);
      return this.paymentService.handleNotification(notification);
  }
}
