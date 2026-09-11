import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { ChatDto } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { AiRole } from '@/generated/prisma';

const MAX_INPUT_LENGTH = 1000;
const MAX_CONVERSATIONS_PER_USER = 50;

const SYSTEM_PROMPT = `Kamu adalah asisten kesehatan untuk MamaBear, platform produk ibu dan bayi.

Batasan kamu:
- Hanya jawab pertanyaan seputar kesehatan ibu hamil, menyusui, dan perawatan bayi
- JANGAN pernah memberikan diagnosis medis
- JANGAN merekomendasikan obat atau dosis spesifik
- Selalu sarankan untuk berkonsultasi dengan dokter untuk masalah serius
- Gunakan bahasa Indonesia yang mudah dipahami
- Jawaban maksimal 3-4 kalimat

Jika pengguna bertanya di luar scope, balas:
"Maaf, saya hanya bisa membantu pertanyaan seputar kesehatan ibu dan bayi. Untuk pertanyaan lain, silakan hubungi customer service kami."`;

@Injectable()
export class AiService {
  constructor(
    private readonly aiRepo: AiRepository,
    private readonly openRouter: OpenRouterClient,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiService.name);
  }

  async chat(userId: string, dto: ChatDto): Promise<ChatResponseDto> {
    if (dto.message.length > MAX_INPUT_LENGTH) {
      throw new BadRequestException(
        'Pesan terlalu panjang. Maksimal 1000 karakter.',
      );
    }

    let conversationId = dto.conversationId;

    if (conversationId) {
      const existing = await this.aiRepo.findConversationById(
        conversationId,
        userId,
      );
      if (!existing) {
        throw new NotFoundException('Percakapan tidak ditemukan.');
      }
    } else {
      const count = await this.aiRepo.countConversationsByUser(userId);
      if (count >= MAX_CONVERSATIONS_PER_USER) {
        throw new BadRequestException(
          'Batas percakapan aktif tercapai (50 percakapan). Hapus percakapan lama terlebih dahulu.',
        );
      }

      const conversation = await this.aiRepo.createConversation(userId);
      conversationId = conversation.id;
    }

    await this.aiRepo.createMessage({
      conversationId,
      role: AiRole.USER,
      content: dto.message,
    });

    const history = await this.aiRepo.findMessagesByConversation(
      conversationId,
      userId,
    );

    const messages = this.buildPrompt(dto.message, history);

    const result = await this.openRouter.chat(messages);

    await this.aiRepo.createMessage({
      conversationId,
      role: AiRole.ASSISTANT,
      content: result.content,
      tokensUsed: result.tokensUsed,
      model: result.model,
    });

    await this.aiRepo.updateConversationTimestamp(conversationId);

    return {
      success: true,
      message: 'Pesan berhasil diproses',
      data: {
        conversationId,
        reply: result.content,
        blocked: false,
      },
    };
  }

  private buildPrompt(
    userMessage: string,
    history: { role: AiRole; content: string }[],
  ) {
    const messages: {
      role: 'user' | 'assistant' | 'system';
      content: string;
    }[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === AiRole.USER) {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === AiRole.ASSISTANT) {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    return messages;
  }
}
