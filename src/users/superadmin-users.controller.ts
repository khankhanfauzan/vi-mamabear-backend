import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { RolesGuard } from '@/auth/guard/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminActivityLogService } from '@/activity-log/admin-activity-log.service';

@ApiTags('users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.SUPERADMIN])
export class SuperAdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityLogService: AdminActivityLogService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() createUserDto: CreateUserDto) {
    const result = await this.usersService.create(createUserDto);
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'CREATE', 'User', result.data.id);
    }
    return result;
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    if(req.user.sub === id) {
        throw new ForbiddenException('Cannot self delete current logged in user!');
    }
    const result = await this.usersService.remove(req.user, id);
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'DELETE', 'User', id);
    }
    return result;
  }

  @Put(':id/role')
  async updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const result = await this.usersService.updateRole(id, dto, {
      id: req.user.sub,
      role: req.user.role,
    });
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'UPDATE_ROLE', 'User', id);
    }
    return result;
  }

  @Put(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const result = await this.usersService.updateStatus(id, dto, {
      id: req.user.sub,
      role: req.user.role,
    });
    if (result.success) {
      this.activityLogService.log(req.user.sub, 'UPDATE_STATUS', 'User', id);
    }
    return result;
  }
}
