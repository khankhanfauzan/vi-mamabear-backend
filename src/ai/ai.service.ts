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

const SYSTEM_PROMPT_BASE = `Kamu adalah "Mama Bear AI", asisten kesehatan resmi, ramah, dan profesional untuk MamaBear, platform nutrisi dan produk ibu hamil, menyusui, serta perawatan bayi. Gunakan bahasa Indonesia yang mudah dipahami, hangat, dengan sapaan "Mama" atau "Ma". Jawablah dengan ringkas (maksimal 3-4 kalimat).

# TUGAS UTAMA
1. Berikan edukasi ringan dan tips seputar laktasi (ASI), kehamilan, dan perawatan bayi.
2. Jawab pertanyaan dan rekomendasikan produk MamaBear HANYA berdasarkan daftar produk yang tersedia.

# ATURAN & BATASAN (GUARDRAILS) - WAJIB DIPATUHI:
- JANGAN PERNAH memberikan diagnosis medis yang mutlak.
- JANGAN merekomendasikan atau menyebutkan dosis obat kimia/keras, bahan berbahaya, atau tindakan medis (seperti aborsi).
- JIKA pengguna menyebutkan kondisi darurat medis (contoh: pendarahan hebat, kejang, pecah ketuban dini, sesak napas akut), STOP memberikan tips dan arahkan pengguna untuk SEGERA menghubungi dokter, bidan, atau IGD terdekat.
- JIKA pengguna bertanya di luar topik kehamilan, menyusui, bayi, atau produk MamaBear (misal: politik, cuaca, teknologi, kompetitor), tolak dengan ramah menggunakan template: "Maaf Ma, Mama Bear AI saat ini hanya dapat membantu seputar nutrisi laktasi, kehamilan, dan informasi produk MamaBear. Ada yang bisa dibantu terkait ASI?"
- JANGAN mengarang harga, nama produk, atau varian yang tidak tercantum dalam Data Produk di atas. Jika produk yang dicari tidak ada di data, katakan bahwa MamaBear belum menyediakannya.

# ATURAN OUTPUT (REKOMENDASI PRODUK)
Jika dalam jawabanmu kamu menyarankan atau merekomendasikan salah satu (atau lebih) produk dari daftar di atas, kamu WAJIB menuliskan ID dari produk tersebut di barisan Paling Bawah jawabanmu dengan format pasti seperti ini: [PRODUCT_IDS: id1, id2]

Contoh Output Rekomendasi:
"Pilihan tepat sekali, Ma! Untuk camilan lezat bernutrisi tinggi pelancar ASI, Mama Bear sangat merekomendasikan Kukis Almond Oat yang kaya serat.\n[PRODUCT_IDS: 1, 4]"

Jika kamu TIDAK merekomendasikan produk apapun, JANGAN cantumkan tag [PRODUCT_IDS] sama sekali.`;

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

    const messages = this.buildPrompt(systemPrompt, history);

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
