import { Injectable } from '@nestjs/common';
import {
  BLOCK_REASONS,
  BlockReason,
  EMERGENCY_MEDICAL_KEYWORDS,
  OUT_OF_SCOPE_KEYWORDS,
  PRESCRIPTION_KEYWORDS,
  OUTPUT_MEDICAL_DIAGNOSIS_KEYWORDS,
  OUTPUT_PRESCRIPTION_KEYWORDS,
} from './blocked-keywords';

export interface GuardrailResult {
  blockReason: BlockReason;
  responseMessage: string;
}

/**
 * GuardrailService memeriksa input pesan pengguna SEBELUM dikirim ke LLM.
 *
 * Tiga kategori blok (urutan prioritas):
 *  1. Darurat medis     → EMERGENCY_MEDICAL_QUERY
 *  2. Resep / dosis     → PRESCRIPTION_REQUEST
 *  3. Di luar scope     → OUT_OF_SCOPE
 *
 * Mengembalikan `null` jika pesan aman untuk diproses LLM.
 */
@Injectable()
export class GuardrailService {
  private readonly rules: Array<{
    patterns: RegExp[];
    blockReason: BlockReason;
    responseMessage: string;
  }> = [
    {
      patterns: EMERGENCY_MEDICAL_KEYWORDS,
      blockReason: BLOCK_REASONS.EMERGENCY,
      responseMessage:
        'Kondisi ini mengindikasikan darurat medis, segera hubungi dokter/IGD terdekat atau WhatsApp MamaBear (628888695757).',
    },
    {
      patterns: PRESCRIPTION_KEYWORDS,
      blockReason: BLOCK_REASONS.PRESCRIPTION,
      responseMessage:
        'Saya tidak dapat memberikan resep atau rekomendasi dosis obat. Silakan konsultasikan langsung dengan dokter atau apoteker Anda.',
    },
    {
      patterns: OUT_OF_SCOPE_KEYWORDS,
      blockReason: BLOCK_REASONS.OUT_OF_SCOPE,
      responseMessage:
        'Maaf, saya hanya bisa membantu pertanyaan seputar kesehatan ibu hamil, menyusui, dan perawatan bayi. Untuk pertanyaan lain, silakan hubungi customer service kami.',
    },
  ];

  /**
   * Periksa apakah pesan perlu diblok.
   *
   * @param message Pesan raw dari pengguna
   * @returns GuardrailResult jika diblok, null jika aman
   */
  check(message: string): GuardrailResult | null {
    const normalizedMessage = message.trim().toLowerCase();

    for (const rule of this.rules) {
      const matched = rule.patterns.some((pattern) =>
        pattern.test(normalizedMessage),
      );

      if (matched) {
        return {
          blockReason: rule.blockReason,
          responseMessage: rule.responseMessage,
        };
      }
    }

    return null;
  }

  /**
   * Periksa apakah respons dari LLM perlu diblok (output guardrail).
   *
   * @param message Respons teks dari LLM
   * @returns GuardrailResult jika diblok, null jika aman
   */
  checkOutput(message: string): GuardrailResult | null {
    const normalizedMessage = message.trim().toLowerCase();

    // 1. Diagnosis Medis
    const diagnosisMatched = OUTPUT_MEDICAL_DIAGNOSIS_KEYWORDS.some((pattern) =>
      pattern.test(normalizedMessage),
    );
    if (diagnosisMatched) {
      return {
        blockReason: BLOCK_REASONS.MEDICAL_DIAGNOSIS,
        responseMessage:
          'Maaf, saya tidak dapat memberikan diagnosis medis. Silakan konsultasikan kondisi Anda dengan dokter atau hubungi WhatsApp MamaBear (628888695757).',
      };
    }

    // 2. Rekomendasi Obat Spesifik
    const prescriptionMatched = OUTPUT_PRESCRIPTION_KEYWORDS.some((pattern) =>
      pattern.test(normalizedMessage),
    );
    if (prescriptionMatched) {
      return {
        blockReason: BLOCK_REASONS.SPECIFIC_PRESCRIPTION,
        responseMessage:
          'Maaf, saya tidak dapat merekomendasikan obat atau dosis spesifik. Silakan konsultasikan dengan dokter Anda atau hubungi WhatsApp MamaBear (628888695757).',
      };
    }

    return null;
  }
}
