import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { ChatDto } from './dto/chat.dto';
import { ChatResponseDto, RecommendedProductDto } from './dto/chat-response.dto';
import { AiRole } from '@/generated/prisma';
import { ConversationSummaryDto } from './dto/conversation-summary.dto';
import { ConversationHistoryDto } from './dto/conversation-history.dto';
import { GuardrailService } from './guardrail/guardrail.service';

const MAX_INPUT_LENGTH = 1000;
const MAX_CONVERSATIONS_PER_USER = 50;

const PRODUCT_IDS_REGEX = /\[PRODUCT_IDS:\s*([\d,\s]+)\]/;

const SYSTEM_PROMPT_BASE = `Kamu adalah "Mama Bear AI", asisten kesehatan resmi, ramah, hangat, dan profesional untuk MamaBear, platform nutrisi dan perawatan ibu hamil, menyusui, serta bayi.

# ATURAN BAHASA & GAYA KOMUNIKASI (SANGAT KETAT):
1. WAJIB SELALU MENJAWAB HANYA DALAM BAHASA INDONESIA. DILARANG KERAS menggunakan Bahasa Inggris atau bahasa lainnya.
2. Selalu gunakan sapaan hangat "Mama" atau "Ma" dengan nada empati, ramah, dan solutif.
3. Jawablah dengan ringkas dan to the point (maksimal 3-4 kalimat).
4. DILARANG KERAS menampilkan proses berpikir, analisis internal, atau catatan evaluasi (contoh dilarang: "The user is asking...", "I need to check...", "Looking at the data...", "In conclusion..."). Balasanmu harus LANGSUNG berupa pesan ramah kepada Mama.

# ATURAN REKOMENDASI PRODUK (SANGAT PENTING):
1. DILARANG menuliskan daftar/list produk mentah, daftar ID produk, atau spesifikasi panjang di dalam teks pesan (karena kartu produk interaktif akan dimunculkan otomatis oleh sistem dari data produk).
2. Di dalam teks pesan, rekomendasikan produk secara natural dan ramah dalam 1-2 kalimat (misal: menyebutkan keunggulan produk yang relevan dengan pertanyaan Mama).
3. Jika merekomendasikan produk dari data yang tersedia, kamu WAJIB meletakkan tag [PRODUCT_IDS: id1, id2] HANYA DI BARIS PALING BAWAH teks jawabanmu.
4. Jika TIDAK merekomendasikan produk apapun, JANGAN cantumkan tag [PRODUCT_IDS] sama sekali.

# CONTOH OUTPUT YANG BENAR:
"Halo Ma! Untuk bentuk kapsul praktis pelancar ASI tanpa rasa herba yang kuat, Mama Bear sangat merekomendasikan MamaBear ASI Booster Kapsul. Kandungan daun katuk dan kelor di dalamnya efektif membantu meningkatkan produksi dan nutrisi ASI Mama. Tetap penuhi asupan cairan ya, Ma!
[PRODUCT_IDS: 5]"

# ATURAN & BATASAN KESEHATAN (GUARDRAILS) - WAJIB:
- JANGAN PERNAH memberikan diagnosis medis yang mutlak.
- JANGAN merekomendasikan obat kimia keras, bahan berbahaya, atau tindakan medis berbahaya.
- JIKA pengguna menyebutkan kondisi darurat medis (pendarahan hebat, kejang, pecah ketuban dini, sesak napas akut), SEGERA arahkan pengguna ke dokter/IGD terdekat.
- JIKA pengguna bertanya di luar topik kehamilan, menyusui, bayi, atau produk MamaBear, tolak dengan ramah: "Maaf Ma, Mama Bear AI saat ini hanya dapat membantu seputar nutrisi laktasi, kehamilan, dan informasi produk MamaBear. Ada yang bisa dibantu terkait ASI?"
- JANGAN mengarang produk yang tidak ada di [DATA_PRODUK_AKTIF].`;

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

PENTING:
1. Rekomendasikan HANYA produk dari daftar di atas yang relevan dengan kebutuhan Mama.
2. JANGAN salin atau ketik ulang daftar produk di atas ke dalam jawabanmu. Cukup rekomendasikan dengan menyebutkan nama produk dan cantumkan tag [PRODUCT_IDS: id] di baris paling bawah.`;
}

function sanitizeAiReply(
  content: string,
  recommendedProducts: { name: string }[],
): string {
  let cleaned = content;

  // 1. Hapus tag <think>...</think>
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Bersihkan jika LLM membocorkan internal thought / English reasoning
  const isReasoningPreamble =
    /^(?:The user is asking|I need to check|Looking at the data|Looking at the provided)/i.test(
      cleaned.trim(),
    );

  if (isReasoningPreamble) {
    const matchConclusion = cleaned.match(
      /(?:Yes,?\s*(?:ID\s*\d+\s*is\s*)?the\s*[\w\s-]*product:?\s*["']?([^"'\n]+)["']?|Therefore,?\s*([^.\n]+)|So,?\s*([^.\n]+))/i,
    );
    const conclusionName =
      matchConclusion?.[1]?.trim() ||
      matchConclusion?.[2]?.trim() ||
      recommendedProducts[0]?.name;

    if (conclusionName) {
      cleaned = `Halo Ma! Untuk produk yang Mama cari, Mama Bear sangat merekomendasikan ${conclusionName.replace(/^["'\s]+|["'\s]+$/g, '')}. Produk ini diformulasikan khusus untuk mendukung kebutuhan nutrisi dan laktasi Mama.`;
    } else if (recommendedProducts.length > 0) {
      cleaned = `Halo Ma! Untuk produk yang Mama cari, Mama Bear sangat merekomendasikan ${recommendedProducts[0].name}. Produk ini diformulasikan khusus untuk mendukung kebutuhan nutrisi dan laktasi Mama.`;
    } else {
      cleaned = `Halo Ma! Mama Bear siap membantu kebutuhan nutrisi laktasi dan kehamilan Mama. Ada yang bisa kami bantu seputar produk MamaBear?`;
    }
  }

  // 3. Hapus sisa format daftar ID jika LLM menuliskan "- ID 1: ..." atau "ID 1: ..." di dalam teks
  cleaned = cleaned
    .replace(/^[-\s*]*ID\s*\d+:.*$/gmi, '')
    .replace(/^[-\s*]*ID\s*$/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
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

      const response: ChatResponseDto = {
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

      this.logger.info(
        {
          userId,
          conversationId: blockedConversationId,
          response,
        },
        'Chat API response sent (blocked by input guardrail)',
      );

      return response;
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

    this.logger.info(
      {
        userId,
        conversationId,
        model: result.model,
        tokensUsed: result.tokensUsed,
        rawContent: result.content,
      },
      'OpenRouter API response received',
    );

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

      const response: ChatResponseDto = {
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

      this.logger.info(
        {
          userId,
          conversationId,
          response,
        },
        'Chat API response sent (blocked by output guardrail)',
      );

      return response;
    }
    // ── End Output Guardrail Check ───────────────────────────────────

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
    const matchedProductIds = new Set<number>();

    if (productTagMatch) {
      const idsStr = productTagMatch[1];
      idsStr
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id))
        .forEach((id) => matchedProductIds.add(id));

      // Remove the tag from the reply text
      finalContent = finalContent.replace(PRODUCT_IDS_REGEX, '').trim();
    } else {
      // Fallback: Jika LLM menyebutkan ID produk (misal: "ID 5", "ID: 5") tanpa format tag [PRODUCT_IDS: ...]
      const availableIds = new Set(products.map((p) => p.id));
      const fallbackMatches = finalContent.matchAll(
        /(?:ID|produk)\s*[:#-]?\s*(\d+)/gi,
      );
      for (const match of fallbackMatches) {
        const id = parseInt(match[1], 10);
        if (availableIds.has(id)) {
          matchedProductIds.add(id);
        }
      }
    }

    if (matchedProductIds.size > 0) {
      recommendedProducts = await this.aiRepo.findProductsByIds(
        Array.from(matchedProductIds),
      );
    }
    // ── End Extract PRODUCT_IDS ───────────────────────────────────────

    // Bersihkan teks jawaban dari proses berpikir / listing ID berlebih
    finalContent = sanitizeAiReply(finalContent, recommendedProducts);

    // Truncate jika > 500 karakter
    if (finalContent.length > 500) {
      finalContent = finalContent.substring(0, 500) + '...';
    }

    // Tambahkan Disclaimer (hanya sekali)
    const disclaimer =
      '\n\n---\nCatatan: Informasi ini bersifat edukatif dan bukan pengganti saran, diagnosis, atau penanganan dari tenaga medis/dokter profesional.';
    finalContent += disclaimer;

    await this.aiRepo.createMessage({
      conversationId,
      role: AiRole.ASSISTANT,
      content: finalContent,
      tokensUsed: result.tokensUsed,
      model: result.model,
      metadata:
        recommendedProducts.length > 0
          ? { products: recommendedProducts }
          : undefined,
    });

    await this.aiRepo.updateConversationTimestamp(conversationId);

    const response: ChatResponseDto = {
      success: true,
      message: 'Pesan berhasil diproses',
      data: {
        conversationId,
        reply: finalContent,
        products: recommendedProducts,
        blocked: false,
      },
    };

    this.logger.info(
      {
        userId,
        conversationId,
        tokensUsed: result.tokensUsed,
        model: result.model,
        recommendedProductsCount: recommendedProducts.length,
        response,
      },
      'Chat API response sent successfully',
    );

    return response;
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
      messages: conversation.messages.map((msg) => {
        let products: RecommendedProductDto[] = [];
        if (msg.metadata) {
          const meta = msg.metadata as any;
          if (Array.isArray(meta)) {
            products = meta;
          } else if (Array.isArray(meta.products)) {
            products = meta.products;
          }
        }

        return {
          id: msg.id,
          conversationId: msg.conversationId,
          role: msg.role,
          content: msg.content,
          blocked: msg.blocked,
          blockReason: msg.blockReason,
          tokensUsed: msg.tokensUsed,
          model: msg.model,
          products,
          createdAt: msg.createdAt,
        };
      }),
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
