import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PagePaginationRequestDto } from '@/common/dto/request/page-pagination.request.dto';

export enum CustomerSortBy {
  NAME = 'name',
  EMAIL = 'email',
  CREATED_AT = 'createdAt',
  TOTAL_SPENT = 'totalSpent',
  TOTAL_ORDERS = 'totalOrders',
}

export enum CustomerSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class AdminCustomersQueryDto extends PagePaginationRequestDto {
  @ApiPropertyOptional({ description: 'Search by name, email, or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by email verification status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: CustomerSortBy,
    default: CustomerSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CustomerSortBy)
  sortBy?: CustomerSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: CustomerSortOrder,
    default: CustomerSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(CustomerSortOrder)
  sortOrder?: CustomerSortOrder;
}
