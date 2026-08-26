import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductReportQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Minimum products sold' })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minSold?: number;

  @ApiPropertyOptional({ description: 'Category ID filter' })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  categoryId?: number;
}
