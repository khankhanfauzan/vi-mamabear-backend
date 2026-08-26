import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  productId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  variantId: number;

  @ApiProperty({ example: 2, default: 1 })
  @IsNumber()
  @Min(1)
  quantity: number = 1;
}
