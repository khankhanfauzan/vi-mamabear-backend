import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { CartModule } from '@/cart/cart.module';

@Module({
  imports: [CartModule],
  providers: [CleanupService],
})
export class SchedulerModule {}
