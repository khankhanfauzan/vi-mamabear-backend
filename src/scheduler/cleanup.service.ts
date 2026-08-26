import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'pino-nestjs';
import { CartService } from '@/cart/cart.service';

@Injectable()
export class CleanupService {
  constructor(
    private readonly cartService: CartService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CleanupService.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCartCleanup() {
    try {
      const start = Date.now();
      const result = await this.cartService.cleanupExpiredCarts();

      this.logger.info(
        {
          deletedCount: result.count,
          durationMs: Date.now() - start,
        },
        'Expired carts cleaned up',
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
        },
        'Failed to clean up expired carts',
      );
    }
  }
}
