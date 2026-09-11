import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiPropertyOptional({
    description:
      'ID percakapan yang sudah ada. Kosongkan untuk memulai percakapan baru.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({
    description: 'Pesan dari pengguna',
    example: 'Apakah aman minum vitamin saat hamil trimester 1?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, {
    message: 'Pesan terlalu panjang. Maksimal 1000 karakter.',
  })
  message: string;
}
