import { OrderStatus } from '@/generated/prisma';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { PagePaginationRequestDto } from '@/common/dto/request/page-pagination.request.dto';

export enum AdminOrderSortBy {
  CREATED_AT = 'createdAt',
  STATUS = 'status',
  TOTAL = 'total',
}

export enum AdminOrderSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class AdminOrdersQueryDto extends PagePaginationRequestDto {
  @ApiPropertyOptional({ description: 'Search by order ID, customer name, or customer email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by order status', enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filter by payment method' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Filter orders created on or after this date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter orders created on or before this date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: AdminOrderSortBy,
    default: AdminOrderSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminOrderSortBy)
  sortBy?: AdminOrderSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: AdminOrderSortOrder,
    default: AdminOrderSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(AdminOrderSortOrder)
  sortOrder?: AdminOrderSortOrder;
}
