import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { ChatDto } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { AiRole } from '@/generated/prisma';
import { ConversationSummaryDto } from './dto/conversation-summary.dto';
import { ConversationHistoryDto } from './dto/conversation-history.dto';

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
        const oldest = await this.aiRepo.findOldestConversationByUser(userId);
        if (oldest) {
          await this.aiRepo.deleteConversation(oldest.id, userId);
          this.logger.info(
            { userId, deletedConversationId: oldest.id },
            'Auto-pruned oldest conversation to stay within limit',
          );
        }
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

  async getConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const conversations = await this.aiRepo.findConversationsByUser(userId);

    return conversations.map((conv) => ({
      id: conv.id,
      userId: conv.userId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessage: conv.messages[0]
        ? {
            id: conv.messages[0].id,
            role: conv.messages[0].role,
            content: conv.messages[0].content,
            createdAt: conv.messages[0].createdAt,
          }
        : null,
    }));
  }

  async getConversationHistory(
    conversationId: string,
    userId: string,
  ): Promise<ConversationHistoryDto> {
    const conversation = await this.aiRepo.findMessagesByConversationId(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new NotFoundException('Percakapan tidak ditemukan.');
    }

    return {
      id: conversation.id,
      userId: conversation.userId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        blocked: msg.blocked,
        blockReason: msg.blockReason,
        tokensUsed: msg.tokensUsed,
        model: msg.model,
        createdAt: msg.createdAt,
      })),
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

  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.aiRepo.deleteConversation(conversationId, userId);
      return {
        success: true,
        message: 'Percakapan berhasil dihapus.',
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'CONVERSATION_NOT_FOUND'
      ) {
        throw new NotFoundException('Percakapan tidak ditemukan.');
      }
      throw error;
    }
  }
}
