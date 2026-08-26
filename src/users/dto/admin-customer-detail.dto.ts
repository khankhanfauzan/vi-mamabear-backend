import { ApiProperty } from '@nestjs/swagger';
import { AddressDto } from './address.dto';
import { AdminCustomerOrderSummaryDto } from './admin-customer-order-summary.dto';

export class AdminCustomerDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  registeredAt: Date;

  @ApiProperty({ nullable: true })
  updatedAt: Date | null;

  @ApiProperty({ type: [AddressDto] })
  addresses: AddressDto[];

  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  totalSpent: number;

  @ApiProperty()
  averageOrderValue: number;

  @ApiProperty({ nullable: true })
  lastOrderDate: Date | null;

  @ApiProperty({ type: [AdminCustomerOrderSummaryDto] })
  orderHistory: AdminCustomerOrderSummaryDto[];
}
