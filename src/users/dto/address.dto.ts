import { ApiProperty } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  provinceName: string;

  @ApiProperty()
  cityName: string;

  @ApiProperty()
  districtName: string;

  @ApiProperty()
  subdistrictName: string;

  @ApiProperty()
  postalCode: string;

  @ApiProperty()
  road: string;

  @ApiProperty()
  completeAddress: string;

  @ApiProperty({ nullable: true })
  detail: string | null;

  @ApiProperty()
  usedFor: string;

  @ApiProperty({ nullable: true })
  createdAt?: Date;

  @ApiProperty({ nullable: true })
  updatedAt?: Date | null;
}
