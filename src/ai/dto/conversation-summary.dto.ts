import { ApiProperty } from '@nestjs/swagger';
import { AiRole } from '@/generated/prisma';

class LastMessageDto {
  @ApiProperty({ example: 'msg-uuid-123' })
  id: string;

  @ApiProperty({ enum: AiRole, example: AiRole.ASSISTANT })
  role: AiRole;

  @ApiProperty({
    example: 'Vitamin prenatal umumnya aman diminum saat hamil trimester 1...',
  })
  content: string;

  @ApiProperty({ example: '2026-09-12T02:36:08.519Z' })
  createdAt: Date;
}

export class ConversationSummaryDto {
  @ApiProperty({ example: 'conv-uuid-456' })
  id: string;

  @ApiProperty({ example: 'user-uuid-789' })
  userId: string;

  @ApiProperty({ example: '2026-09-12T00:08:24.830Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-12T02:36:16.295Z' })
  updatedAt: Date;

  @ApiProperty({ type: LastMessageDto, nullable: true })
  lastMessage: LastMessageDto | null;
}
