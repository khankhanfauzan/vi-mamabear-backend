import { ApiProperty } from '@nestjs/swagger';
import { AiRole } from '@/generated/prisma';
import { RecommendedProductDto } from './chat-response.dto';

export class AiMessageDto {
  @ApiProperty({ example: 'msg-uuid-123' })
  id: string;

  @ApiProperty({ example: 'conv-uuid-456' })
  conversationId: string;

  @ApiProperty({ enum: AiRole, example: AiRole.USER })
  role: AiRole;

  @ApiProperty({ example: 'Apakah aman minum vitamin saat hamil?' })
  content: string;

  @ApiProperty({ example: false })
  blocked: boolean;

  @ApiProperty({ example: null })
  blockReason: string | null;

  @ApiProperty({ example: 150 })
  tokensUsed: number;

  @ApiProperty({ example: 'openrouter/deepseek/deepseek-chat' })
  model: string;

  @ApiProperty({
    type: [RecommendedProductDto],
    description: 'Daftar rekomendasi produk yang relevan dengan pesan asisten',
    example: [],
  })
  products: RecommendedProductDto[];

  @ApiProperty({ example: '2026-09-12T00:08:24.830Z' })
  createdAt: Date;
}

export class ConversationHistoryDto {
  @ApiProperty({ example: 'conv-uuid-456' })
  id: string;

  @ApiProperty({ example: 'user-uuid-789' })
  userId: string;

  @ApiProperty({ example: '2026-09-12T00:08:24.830Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-12T02:36:16.295Z' })
  updatedAt: Date;

  @ApiProperty({ type: [AiMessageDto] })
  messages: AiMessageDto[];
}
