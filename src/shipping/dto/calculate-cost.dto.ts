import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsPositive, IsString, Min } from 'class-validator';

export enum PriceSort {
  DESCENDING = 'highest',
  ASCENDING = 'lowest',
}

export class CalculateShippingCostDto {
  @ApiProperty({
    example: 114,
    description: 'Destination location ID',
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  destination!: number;

  @ApiProperty({
    enum: PriceSort,
    example: PriceSort.DESCENDING,
    description: 'Sort shipping price result',
  })
  @IsEnum(PriceSort)
  priceSortDirection?: PriceSort;
}
