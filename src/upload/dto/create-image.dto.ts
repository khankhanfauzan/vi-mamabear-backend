import { IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateImageDto {
  @ApiProperty({
    example:
      'https://raw.githubusercontent.com/revou-fsse/mamabear-backend/main/assets/images/AlmonMix/AlmonMix-01.jpg',
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  sortOrder: number;

  @IsString()
  publicId: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ example: 'MamaBear AlmonMix 01' })
  @IsString()
  @IsOptional()
  altText?: string;
}
