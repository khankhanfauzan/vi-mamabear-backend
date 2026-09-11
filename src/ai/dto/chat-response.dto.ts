import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Pesan berhasil diproses' })
  message: string;

  @ApiProperty({
    description: 'Detail respons AI',
    example: {
      conversationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reply: 'Vitamin prenatal umumnya aman diminum saat hamil trimester 1...',
      blocked: false,
    },
  })
  data: {
    conversationId: string;
    reply: string;
    blocked: boolean;
    blockReason?: string;
  };
}
