import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CursorPaginationRequestDto } from '@/common/dto/request/pagination.request.dto';

export enum ReviewSortBy {
  CREATED_AT = 'createdAt',
  UPVOTES = 'numUpvotes',
}

export enum ReviewSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ReviewPaginationDto extends CursorPaginationRequestDto {
  @ApiPropertyOptional({ description: 'Minimum rating filter (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Maximum rating filter (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxRating?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ReviewSortBy,
    default: ReviewSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(ReviewSortBy)
  sortBy?: ReviewSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ReviewSortOrder,
    default: ReviewSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(ReviewSortOrder)
  sortOrder?: ReviewSortOrder;
}
