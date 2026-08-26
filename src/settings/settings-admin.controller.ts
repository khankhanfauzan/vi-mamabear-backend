import { Controller, Get, Param, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { AdminActivityLogService } from '@/activity-log/admin-activity-log.service';

@ApiTags('settings (admin)')
@Controller('admin/settings')
@UseGuards(new JwtAuthGuard())
@Roles([Role.ADMIN])
@ApiBearerAuth('JwtAuthGuard')
export class SettingsAdminController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly activityLogService: AdminActivityLogService,
  ) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Put(':key')
  async update(@Req() req: any, @Param('key') key: string, @Body() dto: UpdateSettingDto) {
    const result = await this.settingsService.upsertByKey(key, dto);
    this.activityLogService.log(req.user.sub, 'UPDATE', 'Setting', key);
    return result;
  }
}
