import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { UsersRepository } from './users.repository';
import { SuperAdminUsersController } from './superadmin-users.controller';

@Module({
  controllers: [AdminUsersController, SuperAdminUsersController, AdminCustomersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
