import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCustomerStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isBlocked: boolean;
}
