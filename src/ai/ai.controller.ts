import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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
}
