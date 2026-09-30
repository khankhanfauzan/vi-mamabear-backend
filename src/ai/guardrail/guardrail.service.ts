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
import { pickHumanizedMessage } from './guardrail-messages';

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
  }> = [
    {
      patterns: EMERGENCY_MEDICAL_KEYWORDS,
      blockReason: BLOCK_REASONS.EMERGENCY,
    },
    {
      patterns: PRESCRIPTION_KEYWORDS,
      blockReason: BLOCK_REASONS.PRESCRIPTION,
    },
    {
      patterns: OUT_OF_SCOPE_KEYWORDS,
      blockReason: BLOCK_REASONS.OUT_OF_SCOPE,
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
          responseMessage: pickHumanizedMessage(rule.blockReason),
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
        responseMessage: pickHumanizedMessage(BLOCK_REASONS.MEDICAL_DIAGNOSIS),
      };
    }

    // 2. Rekomendasi Obat Spesifik
    const prescriptionMatched = OUTPUT_PRESCRIPTION_KEYWORDS.some((pattern) =>
      pattern.test(normalizedMessage),
    );
    if (prescriptionMatched) {
      return {
        blockReason: BLOCK_REASONS.SPECIFIC_PRESCRIPTION,
        responseMessage: pickHumanizedMessage(
          BLOCK_REASONS.SPECIFIC_PRESCRIPTION,
        ),
      };
    }

    return null;
  }
}
