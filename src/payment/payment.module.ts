import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { MidtransService } from './midtrans.service';
import { OrderModule } from '@/order/order.module';

@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService, MidtransService],
})
export class PaymentModule {}
