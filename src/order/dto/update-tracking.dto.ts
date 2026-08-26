import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateTrackingDto {
  @ApiProperty({
    example: 'JNE1234567890',
  })
  @IsString()
  trackingNumber!: string;
}
