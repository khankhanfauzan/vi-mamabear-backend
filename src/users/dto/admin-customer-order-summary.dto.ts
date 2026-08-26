import { ApiProperty } from '@nestjs/swagger';

export class AdminCustomerOrderSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  subtotalIdr: number;

  @ApiProperty()
  taxIdr: number;

  @ApiProperty()
  shippingCostIdr: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  updatedAt: Date | null;
}
