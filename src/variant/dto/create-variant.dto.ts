import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateImageDto } from '@/upload/dto/create-image.dto';

export class CreateVariantDto {
  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  productId?: number;

  @ApiProperty({ example: 'S-26 Procal Gold 3 - 900g' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: [CreateImageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  @IsOptional()
  images?: CreateImageDto[];

  @ApiProperty({ example: 185000 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  priceIdr: number;

  @ApiProperty({ example: 900 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  weightG: number;

  @ApiPropertyOptional({ example: 'S26-PROCAL-3-900' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder: number;
}
