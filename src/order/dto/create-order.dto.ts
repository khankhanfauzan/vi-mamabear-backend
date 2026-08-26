import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';


export class CreateOrderDto {
  @ApiProperty({ description: 'UUID' })
  @IsUUID()
  @IsNotEmpty()
  cartId: string;

  @ApiProperty({ example: 1, description: 'id of final selected address' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  addressId: number;

  @ApiPropertyOptional({ description: 'notes from customer' })
  @IsString()
  @IsOptional()
  notes?: string;
}
