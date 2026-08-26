import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PagePaginationRequestDto } from '@/common/dto/request/page-pagination.request.dto';

export enum ActivityLogSortBy {
  CREATED_AT = 'createdAt',
  ACTION = 'action',
  ENTITY = 'entity',
}

export enum ActivityLogSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class AdminActivityLogQueryDto extends PagePaginationRequestDto {
  @ApiPropertyOptional({ description: 'Filter by action' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by entity' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ description: 'Filter logs created on or after this date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter logs created on or before this date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ActivityLogSortBy,
    default: ActivityLogSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(ActivityLogSortBy)
  sortBy?: ActivityLogSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ActivityLogSortOrder,
    default: ActivityLogSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(ActivityLogSortOrder)
  sortOrder?: ActivityLogSortOrder;
}
