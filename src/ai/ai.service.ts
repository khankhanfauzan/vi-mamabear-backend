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
import { GuardrailService } from './guardrail/guardrail.service';

const MAX_INPUT_LENGTH = 1000;
const MAX_CONVERSATIONS_PER_USER = 50;

const PRODUCT_IDS_REGEX = /\[PRODUCT_IDS:\s*([\d,\s]+)\]/;

const SYSTEM_PROMPT_BASE = `Kamu adalah asisten kesehatan untuk MamaBear, platform produk ibu dan bayi.

Batasan kamu:
- Hanya jawab pertanyaan seputar kesehatan ibu hamil, menyusui, dan perawatan bayi
- JANGAN pernah memberikan diagnosis medis
- JANGAN merekomendasikan obat atau dosis spesifik
- Selalu sarankan untuk berkonsultasi dengan dokter untuk masalah serius
- Gunakan bahasa Indonesia yang mudah dipahami
- Jawaban maksimal 3-4 kalimat
- Jika kamu merekomendasikan suatu produk, sisipkan tag [PRODUCT_IDS: id1,id2] tepat di akhir balasanmu sebelum disclaimer.

Jika pengguna bertanya di luar scope, balas:
"Maaf, saya hanya bisa membantu pertanyaan seputar kesehatan ibu dan bayi. Untuk pertanyaan lain, silakan hubungi customer service kami."`;

type ProductContext = {
  id: number;
  name: string;
  ingredients: string | null;
  description: string | null;
  categoryName: string | null;
  price: number;
};

function buildSystemPrompt(products: ProductContext[]): string {
  if (products.length === 0) return SYSTEM_PROMPT_BASE;

  const productList = products
    .map((p) => {
      const parts = [`ID ${p.id}: ${p.name}`];
      if (p.price > 0) parts.push(`Rp${p.price.toLocaleString('id-ID')}`);
      if (p.categoryName) parts.push(`Kategori: ${p.categoryName}`);
      if (p.ingredients) parts.push(`Komposisi: ${p.ingredients}`);
      if (p.description) parts.push(p.description);
      return `- ${parts.join(' | ')}`;
    })
    .join('\n');

  return `${SYSTEM_PROMPT_BASE}

[DATA_PRODUK_AKTIF]:
${productList}

PENTING: Kamu HANYA boleh merekomendasikan produk dari daftar di atas. Jika ditanya produk yang tidak ada di daftar, tolak dengan sopan.`;
}

@Injectable()
export class AiService {
  constructor(
    private readonly aiRepo: AiRepository,
    private readonly openRouter: OpenRouterClient,
    private readonly logger: PinoLogger,
    private readonly guardrail: GuardrailService,
  ) {
    this.logger.setContext(AiService.name);
  }

  async chat(userId: string, dto: ChatDto): Promise<ChatResponseDto> {
    if (dto.message.length > MAX_INPUT_LENGTH) {
      throw new BadRequestException(
        'Pesan terlalu panjang. Maksimal 1000 karakter.',
      );
    }

    // ── Guardrail check ──────────────────────────────────────────────
    const guardrailResult = this.guardrail.check(dto.message);

    if (guardrailResult) {
      this.logger.warn(
        { userId, blockReason: guardrailResult.blockReason },
        'Guardrail blocked message before LLM call',
      );

      // Resolve / buat conversation terlebih dahulu
      let blockedConversationId = dto.conversationId;

      if (blockedConversationId) {
        const existing = await this.aiRepo.findConversationById(
          blockedConversationId,
          userId,
        );
        if (!existing) {
          throw new NotFoundException('Percakapan tidak ditemukan.');
        }
      } else {
        const conversation = await this.aiRepo.createConversation(userId);
        blockedConversationId = conversation.id;
      }

      // Simpan user message dengan flag blocked
      await this.aiRepo.createMessage({
        conversationId: blockedConversationId,
        role: AiRole.USER,
        content: dto.message,
        blocked: true,
        blockReason: guardrailResult.blockReason,
      });

      // Simpan assistant message (respons guardrail) untuk riwayat audit
      await this.aiRepo.createMessage({
        conversationId: blockedConversationId,
        role: AiRole.ASSISTANT,
        content: guardrailResult.responseMessage,
        blocked: true,
        blockReason: guardrailResult.blockReason,
      });

      await this.aiRepo.updateConversationTimestamp(blockedConversationId);

      return {
        success: false,
        message: guardrailResult.responseMessage,
        data: {
          conversationId: blockedConversationId,
          reply: null,
          products: [],
          blocked: true,
          blockReason: guardrailResult.blockReason,
        },
      };
    }
    // ── End guardrail check ──────────────────────────────────────────

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

    // Fetch active products for RAG context
    const products = await this.aiRepo.getActiveProductsForContext();
    const systemPrompt = buildSystemPrompt(products);

    const messages = this.buildPrompt(systemPrompt, dto.message, history);

    const result = await this.openRouter.chat(messages);

    let finalContent = result.content;

    // ── Output Guardrail Check ───────────────────────────────────────
    const outputGuardrailResult = this.guardrail.checkOutput(finalContent);

    if (outputGuardrailResult) {
      this.logger.warn(
        {
          userId,
          conversationId,
          blockReason: outputGuardrailResult.blockReason,
        },
        'Output guardrail blocked message after LLM call',
      );

      await this.aiRepo.createMessage({
        conversationId,
        role: AiRole.ASSISTANT,
        content: outputGuardrailResult.responseMessage,
        blocked: true,
        blockReason: outputGuardrailResult.blockReason,
      });

      await this.aiRepo.updateConversationTimestamp(conversationId);

      return {
        success: false,
        message: outputGuardrailResult.responseMessage,
        data: {
          conversationId,
          reply: null,
          products: [],
          blocked: true,
          blockReason: outputGuardrailResult.blockReason,
        },
      };
    }
    // ── End Output Guardrail Check ───────────────────────────────────

    // Truncate jika > 500 karakter
    if (finalContent.length > 500) {
      finalContent = finalContent.substring(0, 500) + '...';
    }

    // Tambahkan Disclaimer
    const disclaimer =
      '\n\n---\nCatatan: Informasi ini bersifat edukatif dan bukan pengganti saran, diagnosis, atau penanganan dari tenaga medis/dokter profesional.';
    finalContent += disclaimer;

    // ── Extract PRODUCT_IDS from reply ────────────────────────────────
    let recommendedProducts: {
      id: number;
      name: string;
      slug: string;
      category: string | null;
      imageUrl: string | null;
      price: number;
      formattedPrice: string;
      rating: number;
      reviewCount: number;
      totalSold: number;
      shortDescription: string | null;
    }[] = [];

    const productTagMatch = finalContent.match(PRODUCT_IDS_REGEX);

    if (productTagMatch) {
      const idsStr = productTagMatch[1];
      const productIds = idsStr
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));

      // Remove the tag from the reply text
      finalContent = finalContent.replace(PRODUCT_IDS_REGEX, '').trim();

      // Re-add disclaimer after cleaning
      finalContent += disclaimer;

      if (productIds.length > 0) {
        recommendedProducts = await this.aiRepo.findProductsByIds(productIds);
      }
    }
    // ── End Extract PRODUCT_IDS ───────────────────────────────────────

    await this.aiRepo.createMessage({
      conversationId,
      role: AiRole.ASSISTANT,
      content: finalContent,
      tokensUsed: result.tokensUsed,
      model: result.model,
    });

    await this.aiRepo.updateConversationTimestamp(conversationId);

    return {
      success: true,
      message: 'Pesan berhasil diproses',
      data: {
        conversationId,
        reply: finalContent,
        products: recommendedProducts,
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
    systemPrompt: string,
    userMessage: string,
    history: { role: AiRole; content: string }[],
  ) {
    const messages: {
      role: 'user' | 'assistant' | 'system';
      content: string;
    }[] = [{ role: 'system', content: systemPrompt }];

    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === AiRole.USER) {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === AiRole.ASSISTANT) {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

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
