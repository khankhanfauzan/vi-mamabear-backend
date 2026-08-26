import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CreateImageDto } from '@/upload/dto/create-image.dto';
import { CreateVariantDto } from '@/variant/dto/create-variant.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'S-26 Procal Gold 3' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Growing-up formula for children aged 1-3 years.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'Growing-up formula for children aged 1-3 years.',
  })
  @IsString()
  @IsOptional()
  ingredients?: string;

  @ApiPropertyOptional({
    example: 'Growing-up formula for children aged 1-3 years.',
  })
  @IsString()
  @IsOptional()
  usageInstructions?: string;

  // put in default variant
  @ApiProperty({ example: 900 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  weightG: number;

  @ApiProperty({ example: 185000 })
  @Type(() => Number)
  @IsNumber()
  priceIdr: number;

  @ApiPropertyOptional({ example: 50 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 'S26-PROCAL-3-900' })
  @IsString()
  @IsOptional()
  sku?: string;
  // put in default variant

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [CreateImageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  @IsOptional()
  images?: CreateImageDto[];

  @ApiPropertyOptional({ type: [CreateVariantDto] })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }

    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];

  @ApiPropertyOptional({ example: 's-26-procal-gold-3' })
  @IsString()
  @IsOptional()
  slug: string;

  @ApiPropertyOptional({ example: ['formula', 'growing-up', 'toddler'] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  highlightId?: number;
}
