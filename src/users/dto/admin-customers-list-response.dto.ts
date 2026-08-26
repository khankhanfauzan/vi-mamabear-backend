import { ApiProperty } from '@nestjs/swagger';
import { AdminCustomerItemDto } from './admin-customer-item.dto';

export class AdminCustomersListResponseDto {
  @ApiProperty({ type: [AdminCustomerItemDto] })
  items: AdminCustomerItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
