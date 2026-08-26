import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Recipient name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: '081234567890',
    description: 'Recipient phone number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({
    example: 11,
    description: 'Province ID from Raja Ongkir',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  provinceId!: number;

  @ApiProperty({
    example: 'Jawa Timur',
    description: 'Province name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  provinceName!: string;

  @ApiProperty({
    example: 444,
    description: 'City ID from Raja Ongkir',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cityId!: number;

  @ApiProperty({
    example: 'Surabaya',
    description: 'City name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cityName!: string;

  @ApiProperty({
    example: 5678,
    description: 'District ID from Raja Ongkir',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId!: number;

  @ApiProperty({
    example: 'Sambikerep',
    description: 'District name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  districtName!: string;

  @ApiProperty({
    example: 69298,
    description: 'Subdistrict ID from Raja Ongkir',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subdistrictId!: number;

  @ApiProperty({
    example: 'Lontar',
    description: 'Subdistrict name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subdistrictName!: string;

  @ApiProperty({
    example: '60216',
    description: 'Postal code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode!: string;

  @ApiProperty({
    example: 'Jl. Raya Lontar No. 123',
    description: 'Street information',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  road!: string;

  @ApiProperty({
    example: 'Sebelah minimarket',
    description: 'Additional address details',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  detail?: string;

  @ApiProperty({
    example: 'Rumah',
    description: 'Address label (Rumah, Kantor, etc)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  usedFor!: string;
}
