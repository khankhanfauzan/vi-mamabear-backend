import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminActivityLogService } from './admin-activity-log.service';
import { AdminActivityLogQueryDto } from './dto/admin-activity-log-query.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { RolesGuard } from '@/auth/guard/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('activity-log (admin)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.ADMIN, Role.SUPERADMIN])
@Controller('admin/activity-logs')
@ApiBearerAuth('JwtAuthGuard')
export class AdminActivityLogController {
  constructor(private readonly activityLogService: AdminActivityLogService) {}

  @Get()
  findAll(@Query() query: AdminActivityLogQueryDto) {
    return this.activityLogService.findAll(query);
  }
}
