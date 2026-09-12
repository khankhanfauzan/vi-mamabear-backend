import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { GetUserId } from '@/common/decorators/get-user-id-decorator';

@ApiTags('ai')
@ApiBearerAuth('JwtAuthGuard')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Kirim pesan ke AI',
    description: 'Kirim pesan dan dapatkan jawaban dari AI Health Assistant',
  })
  chat(@GetUserId() userId: string, @Body() dto: ChatDto) {
    return this.aiService.chat(userId, dto);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List percakapan AI pengguna',
    description:
      'Mendapatkan daftar percakapan AI lengkap dengan pesan terakhir',
  })
  getConversations(@GetUserId() userId: string) {
    return this.aiService.getConversations(userId);
  }

  @Get('history/:conversationId')
  @ApiOperation({
    summary: 'Riwayat percakapan AI',
    description: 'Mendapatkan seluruh pesan dari sebuah percakapan AI',
  })
  getConversationHistory(
    @GetUserId() userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiService.getConversationHistory(conversationId, userId);
  }
}
