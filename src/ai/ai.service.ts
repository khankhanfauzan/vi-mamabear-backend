import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { ChatDto } from './dto/chat.dto';
import {
  ChatResponseDto,
  RecommendedProductDto,
} from './dto/chat-response.dto';
import { AiRole } from '@/generated/prisma';
import { ConversationSummaryDto } from './dto/conversation-summary.dto';
import { ConversationHistoryDto } from './dto/conversation-history.dto';
import { GuardrailService } from './guardrail/guardrail.service';
import { ProductScopeGuardrailService } from './guardrail/product-scope-guardrail.service';

const MAX_INPUT_LENGTH = 1000;
const MAX_CONVERSATIONS_PER_USER = 50;

const PRODUCT_IDS_REGEX = /\[PRODUCT_IDS:\s*([\d,\s]+)\]/;

const SYSTEM_PROMPT_BASE = `Kamu adalah "Mama Bear AI", asisten kesehatan resmi, ramah, hangat, dan profesional untuk MamaBear, platform nutrisi dan perawatan ibu hamil, menyusui, serta bayi.

# IDENTITAS & SCOPE UTAMA (BACA INI PERTAMA — WAJIB DIPATUHI):
Kamu adalah asisten kesehatan khusus untuk ibu hamil, menyusui, dan perawatan bayi.
SEMUA pertanyaan tentang kehamilan, menyusui, ASI, dan perawatan bayi adalah IN SCOPE dan WAJIB dijawab secara edukatif, suportif, dan aman.

PENTING — Interpretasi konteks wajib (jangan salah tafsir):
1. "ASI sedikit / ASI kurang / ASI seret / asi aku sedikit" = SELALU berarti PRODUKSI ASI RENDAH — BUKAN perasaan lemah/energi/anemia. Jawab dengan tips meningkatkan produksi ASI.
2. "kenapa ASI sedikit" = pertanyaan tentang CARA MENINGKATKAN PRODUKSI ASI. Bahas faktor seperti frekuensi menyusui, asupan cairan, stres, latching, dan pompa ASI.
3. Pertanyaan hipotetikal kesehatan (misal: "kalau ada pendarahan trimester 3 normal ga?") = pertanyaan EDUKASI, bukan situasi darurat — jawab dengan informasi edukatif yang tepat.
4. Jangan pernah mengartikan keluhan seputar ASI sebagai keluhan fisik/energi umum.

# SCOPE EDUKASI KESEHATAN (WAJIB):
5. Pertanyaan edukasi umum tentang kesehatan ibu hamil, menyusui, dan bayi tetap berada dalam scope MamaBear.
6. Topik menyusui seperti kelancaran ASI, produksi ASI, pumping, pelekatan menyusui, nutrisi ibu menyusui, dan perawatan bayi BOLEH dan WAJIB dijawab secara edukatif, suportif, dan aman.
7. Jangan menolak pertanyaan edukasi ASI hanya karena pengguna tidak secara langsung menanyakan produk.
8. Untuk pertanyaan edukasi yang relevan dengan produk MamaBear, jawab edukasinya terlebih dahulu. Setelah itu, jika ada produk yang benar-benar relevan dari DATA_PRODUK_AKTIF, tawarkan secara natural dan tidak memaksa.
9. Jika tidak ada produk yang relevan, cukup berikan jawaban edukasi tanpa memaksakan rekomendasi produk.

# ATURAN BAHASA & GAYA KOMUNIKASI (SANGAT KETAT):
1. WAJIB SELALU MENJAWAB HANYA DALAM BAHASA INDONESIA. DILARANG KERAS menggunakan Bahasa Inggris atau bahasa lainnya.
2. Selalu gunakan sapaan hangat "Mama" atau "Ma" dengan nada empati, ramah, dan solutif.
3. Jawablah dengan ringkas dan to the point (maksimal 3-4 kalimat).
4. DILARANG KERAS menampilkan proses berpikir, analisis internal, atau catatan evaluasi (contoh dilarang: "The user is asking...", "I need to check...", "Looking at the data...", "In conclusion..."). Balasanmu harus LANGSUNG berupa pesan ramah kepada Mama.

# GAYA BAHASA (TONE OF VOICE) - WAJIB:
- Gunakan bahasa Indonesia yang hangat, sopan, dan suportif — seperti teman yang paham dunia parenting.
- Sapa user dengan "Mama"/"Ma" secara natural, jangan berlebihan.
- Hindari kalimat template/formal kaku seperti "Mohon maaf atas ketidaknyamanannya" atau "Sistem kami tidak dapat memproses permintaan Anda".
- Boleh pakai emoji secukupnya (maksimal 1-2 per pesan) untuk kesan hangat, jangan berlebihan.
- Jangan terdengar seperti membaca script; variasikan kalimat pembuka antar respons.
- Jika menolak permintaan, tetap ramah dan tawarkan bantuan alternatif, jangan menolak dengan dingin.

# ATURAN REKOMENDASI PRODUK (SANGAT PENTING):
1. DILARANG menuliskan daftar/list produk mentah, daftar ID produk, atau spesifikasi panjang di dalam teks pesan (karena kartu produk interaktif akan dimunculkan otomatis oleh sistem dari data produk).
2. Di dalam teks pesan, rekomendasikan produk secara natural dan ramah dalam 1-2 kalimat (misal: menyebutkan keunggulan produk yang relevan dengan pertanyaan Mama).
3. Jika merekomendasikan produk dari data yang tersedia, kamu WAJIB meletakkan tag [PRODUCT_IDS: id1, id2] HANYA DI BARIS PALING BAWAH teks jawabanmu.
4. Jika TIDAK merekomendasikan produk apapun, JANGAN cantumkan tag [PRODUCT_IDS] sama sekali.
5. DILARANG KERAS menuliskan ID produk di dalam teks narasi balasan (contoh yang dilarang: "(ID 3)", "ID 5", "(ID: 5)"). Sebutkan NAMA produk saja secara natural. ID produk hanya boleh ditulis pada tag [PRODUCT_IDS: id1, id2] di baris paling bawah.

# CONTOH OUTPUT YANG BENAR:
"Halo Ma! Untuk bentuk kapsul praktis pelancar ASI tanpa rasa herba yang kuat, Mama Bear sangat merekomendasikan MamaBear ASI Booster Kapsul. Kandungan daun katuk dan kelor di dalamnya efektif membantu meningkatkan produksi dan nutrisi ASI Mama. Tetap penuhi asupan cairan ya, Ma!
[PRODUCT_IDS: 5]"

# ATURAN & BATASAN KESEHATAN (GUARDRAILS) - WAJIB:
- JANGAN PERNAH memberikan diagnosis medis yang mutlak.
- JANGAN merekomendasikan obat kimia keras, bahan berbahaya, atau tindakan medis berbahaya.
- JIKA pengguna menyebutkan kondisi darurat medis aktif (pendarahan hebat, kejang, pecah ketuban dini, sesak napas akut), SEGERA arahkan pengguna ke dokter/IGD terdekat.
- JIKA pengguna bertanya di luar topik kehamilan, menyusui, bayi, atau produk MamaBear, tolak dengan ramah: "Maaf Ma, Mama Bear AI saat ini hanya dapat membantu seputar nutrisi laktasi, kehamilan, dan informasi produk MamaBear. Ada yang bisa dibantu terkait ASI?"
- JANGAN mengarang produk yang tidak ada di [DATA_PRODUK_AKTIF].`;


/**
 * Instruksi deteksi ambiguitas dan klarifikasi untuk sistem prompt AI.
 * AI akan merespons dengan prefix [CLARIFY] jika pesan user dinilai ambigu,
 * sehingga backend dapat membedakan respons klarifikasi dari jawaban biasa.
 */
const CLARIFICATION_INSTRUCTION = `
# DETEKSI AMBIGUITAS & KLARIFIKASI (WAJIB DIBACA):
Sebelum menjawab, evaluasi apakah pesan Mama cukup spesifik untuk dijawab dengan akurat.

## Pesan dianggap AMBIGU jika memenuhi MINIMAL SATU dari kondisi berikut:
- Tidak menyebutkan kategori, usia, kondisi, atau kebutuhan spesifik.
  Contoh: "ada produk apa aja?", "rekomendasiin dong", "mau beli sesuatu", "produk bagus apa?".
- Bisa merujuk ke banyak kemungkinan produk atau topik berbeda tanpa konteks tambahan.
  Contoh: "yang bagus buat bayi" (bagus dalam hal apa? usia berapa?).

## Jika AMBIGU:
- JANGAN langsung menjawab dengan asumsi atau daftar produk generik.
- Balas HANYA dengan prefix [CLARIFY] diikuti SATU pertanyaan follow-up singkat yang relevan.
- Format wajib: [CLARIFY] <pertanyaan klarifikasi>
- Contoh respons yang benar:
  [CLARIFY] Boleh tau usia si kecil berapa bulan, Ma? Biar aku bisa kasih rekomendasi yang paling pas 😊
  [CLARIFY] Kebutuhannya lebih ke arah perlengkapan menyusui atau nutrisi untuk Mama ya?

## Jika TIDAK ambigu (user sudah kasih konteks jelas):
- Jawab langsung seperti biasa TANPA prefix [CLARIFY].
- JANGAN tanya balik hanya untuk memastikan.

## ATURAN ANTI-LOOP KLARIFIKASI (SANGAT PENTING):
- Jika dalam riwayat percakapan kamu SUDAH pernah mengirim pertanyaan klarifikasi ([CLARIFY]) untuk topik yang sama,
  JANGAN tanya lagi meski jawaban Mama masih kurang lengkap — jawab dengan informasi yang tersedia saat ini.
- Maksimal 1x klarifikasi berturut-turut untuk 1 topik.

## FEW-SHOT EXAMPLES:

### AMBIGU → balas dengan [CLARIFY]:
User: "ada produk apa aja min?"
AI: [CLARIFY] Boleh cerita dulu, Ma, lagi cari produk untuk kebutuhan apa? Misalnya pelancar ASI, nutrisi kehamilan, atau camilan sehat? 😊

User: "rekomendasiin dong"
AI: [CLARIFY] Tentu, Ma! Biar rekomendasinya pas, boleh tau lagi butuh produk untuk apa ya? Untuk menyusui, kehamilan, atau perawatan bayi?

User: "produk buat bayi apa aja?"
AI: [CLARIFY] Boleh tau usia si kecil berapa bulan, Ma? Biar rekomendasi produknya lebih pas sesuai tahap tumbuh kembangnya 😊

User: "yang bagus buat bayi"
AI: [CLARIFY] Kebutuhannya lebih ke arah perlengkapan menyusui atau suplemen nutrisi untuk Mama yang masih menyusui, Ma?

User: "mau beli sesuatu buat bayi baru lahir"
AI: [CLARIFY] Wah selamat ya Ma! 🎉 Untuk bayi baru lahir, Mama lebih butuh produk perawatan bayi atau produk pelancar ASI untuk Mama?

### TIDAK AMBIGU → jawab langsung tanpa [CLARIFY]:
User: "ada pompa ASI elektrik ga?"
AI: (jawab langsung — sudah spesifik: pompa ASI, tipe elektrik)

User: "anak saya 6 bulan, mau MPASI, ada rekomendasi produk?"
AI: (jawab langsung — sudah ada konteks usia dan kebutuhan MPASI)

User: "cara melancarkan ASI yang seret itu gimana?"
AI: (jawab langsung — pertanyaan edukasi yang spesifik)

User: "ada suplemen DHA untuk ibu hamil trimester 3?"
AI: (jawab langsung — sudah spesifik: suplemen DHA, ibu hamil, trimester 3)

User: "MamaBear ASI Booster kapsul ada stoknya ga?"
AI: (jawab langsung — menyebutkan nama produk spesifik)`;

type ProductContext = {
  id: number;
  name: string;
  ingredients: string | null;
  description: string | null;
  categoryName: string | null;
  price: number;
};

function buildSystemPrompt(products: ProductContext[]): string {
  const base = `${SYSTEM_PROMPT_BASE}\n${CLARIFICATION_INSTRUCTION}`;
  if (products.length === 0) return base;

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

  return `${base}

[DATA_PRODUK_AKTIF]:
${productList}

PENTING:
1. Rekomendasikan HANYA produk dari daftar di atas yang relevan dengan kebutuhan Mama.
2. JANGAN salin atau ketik ulang daftar produk di atas ke dalam jawabanmu. Cukup rekomendasikan dengan menyebutkan nama produk dan cantumkan tag [PRODUCT_IDS: id] di baris paling bawah.
3. JANGAN tulis ID produk (misal "ID 3" atau "(ID 3)") di dalam teks jawaban; ID hanya untuk tag [PRODUCT_IDS].`;
}

function extractProductIdsFromContent(
  content: string,
  availableProducts: ProductContext[],
): Set<number> {
  const matched = new Set<number>();
  const lowerContent = content.toLowerCase();

  for (const product of availableProducts) {
    // 1. Core title before separator (e.g. "MamaBear Kukis Almond Oat - Camilan..." -> "kukis almond oat")
    const titleSegment = product.name.split(/[-–—]/)[0].trim();
    const cleanTitle = titleSegment
      .replace(/^Mama\s*Bear\s*/i, '')
      .replace(/\s*Isi\s*\d+\s*(?:Sachet|Kapsul|Btl|Pcs)?/gi, '')
      .trim()
      .toLowerCase();

    if (cleanTitle.length > 2 && lowerContent.includes(cleanTitle)) {
      matched.add(product.id);
      continue;
    }

    // 2. Specific distinctive product line keywords
    const keywords: string[] = [];
    if (/almonmix/i.test(product.name)) keywords.push('almonmix', 'almon mix');
    if (/zoyamix/i.test(product.name)) keywords.push('zoyamix', 'zoya mix');
    if (/teh/i.test(product.name)) keywords.push('teh pelancar asi', 'teh mamabear', 'teh booster');
    if (/kukis/i.test(product.name)) keywords.push('kukis almond oat', 'kukis almond', 'kukis mamabear', 'kukis');
    if (/kapsul/i.test(product.name)) keywords.push('asi booster 30 kapsul', 'kapsul pelancar asi', 'kapsul booster', 'kapsul mamabear', 'kapsul');

    for (const kw of keywords) {
      if (lowerContent.includes(kw)) {
        matched.add(product.id);
        break;
      }
    }
  }

  return matched;
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
    .replace(/^[-\s*]*ID\s*\d+:.*$/gim, '')
    .replace(/^[-\s*]*ID\s*$/gim, '')
    // 4. Defense-in-depth: buang penyebutan ID produk di tengah narasi
    //    (tag [PRODUCT_IDS] sudah diekstrak sebelum fungsi ini dipanggil)
    .replace(/\s*\((?:ID|id)\s*[:#]?\s*\d+\)/g, '')
    .replace(/\b(?:ID|id)\s*[:#]?\s*\d+\b/g, '')
    .replace(/[^\S\n]{2,}/g, ' ')
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
    private readonly productGuardrail: ProductScopeGuardrailService,
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
    const guardrailResult =
      this.guardrail.check(dto.message) ??
      (await this.productGuardrail.check(dto.message));

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

    // ── Clarification Detection ──────────────────────────────────────
    // Jika LLM menilai pesan user ambigu, ia merespons dengan prefix [CLARIFY].
    // Backend mendeteksi prefix ini, melepasnya dari teks, dan mengembalikan
    // response dengan type='clarification' tanpa melakukan ekstraksi produk.
    const CLARIFY_PREFIX_REGEX = /^\[CLARIFY\]\s*/;
    const isClarification = CLARIFY_PREFIX_REGEX.test(finalContent.trim());

    if (isClarification) {
      finalContent = finalContent
        .trim()
        .replace(CLARIFY_PREFIX_REGEX, '')
        .trim();

      await this.aiRepo.createMessage({
        conversationId,
        role: AiRole.ASSISTANT,
        content: finalContent,
        tokensUsed: result.tokensUsed,
        model: result.model,
      });

      await this.aiRepo.updateConversationTimestamp(conversationId);

      const clarificationResponse: ChatResponseDto = {
        success: true,
        message: 'Pesan berhasil diproses',
        data: {
          conversationId,
          reply: finalContent,
          products: [],
          blocked: false,
          type: 'clarification',
        },
      };

      this.logger.info(
        { userId, conversationId },
        'Chat API response sent (clarification question)',
      );

      return clarificationResponse;
    }
    // ── End Clarification Detection ──────────────────────────────────

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

    // ── Semantic Product Fallback (Bug #3 fix) ────────────────────────
    // When the LLM (especially the small fallback model) does not include
    // [PRODUCT_IDS] or inline ID mentions, we do:
    // 1. Direct Name Mention Matching
    // 2. Vector similarity search as a last resort
    if (matchedProductIds.size === 0 && products.length > 0) {
      const nameMatchedIds = extractProductIdsFromContent(finalContent, products);
      nameMatchedIds.forEach((id) => matchedProductIds.add(id));
      
      // If we still found no products and it's an educational/ASI query, run semantic search
      if (matchedProductIds.size === 0) {
        try {
          const semanticProducts = await this.aiRepo.findProductsBySemanticSearch(
            dto.message,
            3,
            0.22,
          );
        if (semanticProducts.length > 0) {
          recommendedProducts = semanticProducts;
          this.logger.info(
            { userId, conversationId, count: semanticProducts.length },
            'Semantic product fallback: found relevant products',
          );
        }
      } catch (err) {
        this.logger.warn(
          { err },
          'Semantic product fallback search failed, continuing without products',
        );
      }
      } // End of nested if (matchedProductIds.size === 0)
    }
    // ── End Semantic Product Fallback ─────────────────────────────────

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
        type: 'answer',
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
        if (msg.metadata && typeof msg.metadata === 'object') {
          const meta = msg.metadata as Record<string, unknown>;
          if (Array.isArray(meta)) {
            products = meta as RecommendedProductDto[];
          } else if (Array.isArray(meta.products)) {
            products = meta.products as RecommendedProductDto[];
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
