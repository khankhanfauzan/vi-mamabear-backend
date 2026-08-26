import { Global, Module } from '@nestjs/common';
import { AdminActivityLogService } from './admin-activity-log.service';
import { AdminActivityLogRepository } from './admin-activity-log.repository';
import { AdminActivityLogController } from './admin-activity-log.controller';

@Global()
@Module({
  controllers: [AdminActivityLogController],
  providers: [AdminActivityLogService, AdminActivityLogRepository],
  exports: [AdminActivityLogService],
})
export class ActivityLogModule {}
