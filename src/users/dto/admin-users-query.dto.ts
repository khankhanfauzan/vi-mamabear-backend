import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PagePaginationRequestDto } from '@/common/dto/request/page-pagination.request.dto';
import { Role } from '@/generated/prisma';

export enum AdminUsersSortBy {
  NAME = 'name',
  EMAIL = 'email',
  CREATED_AT = 'createdAt',
}

export enum AdminUsersSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class AdminUsersQueryDto extends PagePaginationRequestDto {
  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by role',
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Filter by email verification status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: AdminUsersSortBy,
    default: AdminUsersSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminUsersSortBy)
  sortBy?: AdminUsersSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: AdminUsersSortOrder,
    default: AdminUsersSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(AdminUsersSortOrder)
  sortOrder?: AdminUsersSortOrder;
}
