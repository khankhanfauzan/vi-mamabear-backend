import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CursorPaginationRequestDto {
  @ApiPropertyOptional({ description: 'Index of first element' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({ description: 'Number of rows to fetch' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const num = value !== undefined ? Number(value) : 10;
    return Math.min(num, 10);
  })
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
