import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ example: true, description: 'Set to true to deactivate (block), false to reactivate' })
  @IsBoolean()
  isBlocked: boolean;
}
