import { ApiProperty } from '@nestjs/swagger';

export class RecommendedProductDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Kukis Almond Oat Mama Bear' })
  name: string;

  @ApiProperty({ example: 'kukis-almond-oat-mama-bear' })
  slug: string;

  @ApiProperty({ example: 'SUPERFOOD CAMILAN', nullable: true })
  category: string | null;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../kukis.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({ example: 35000 })
  price: number;

  @ApiProperty({ example: 'Rp 35.000' })
  formattedPrice: string;

  @ApiProperty({ example: 4.9 })
  rating: number;

  @ApiProperty({ example: 14200 })
  reviewCount: number;

  @ApiProperty({ example: 500000 })
  totalSold: number;

  @ApiProperty({
    example: 'Kaya serat & almond superfood untuk melancarkan ASI',
    nullable: true,
  })
  shortDescription: string | null;
}

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
      products: [],
      blocked: false,
    },
  })
  data: {
    conversationId: string;
    reply: string | null;
    products: RecommendedProductDto[];
    blocked: boolean;
    blockReason?: string;
  };
}
