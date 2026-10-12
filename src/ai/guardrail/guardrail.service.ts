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
  /**
   * Patterns that indicate the user is asking an educational or hypothetical
   * question — NOT reporting an active emergency. When these patterns match,
   * the EMERGENCY block rule is skipped so the LLM can answer educationally.
   *
   * Example that should pass: "kalau ada pendarahan di trimester 3 itu normal apa ngga?"
   * Example that must still block: "tolong saya pendarahan parah sekarang!"
   */
  private readonly educationalPatterns: RegExp[] = [
    /\b(?:normal|aman|bahaya|berbahaya|wajar)\s*(?:ga|gak|nggak|ngga|tidak|kah)?\b/i,
    /\b(?:apakah|apa)\s+(?:normal|aman|bahaya|wajar|berbahaya|risiko|penyebab|tanda|gejala)\b/i,
    /\bitu\s+(?:normal|aman|bahaya|wajar|kenapa|mengapa|gimana)\b/i,
    /\b(?:kalau|kalo|jika|misalnya|misal)\s+ada\b/i,
    // "kenapa/gimana/bagaimana" tanpa framing edukatif TIDAK dianggap
    // edukatif — lolos blokir darurat (VIMB-135). "Apa penyebab ..."
    // tetap edukatif karena murni permintaan informasi.
    /\b(?:penyebab|apa\s+penyebab)\b/i,
    /\b(?:cara\s+mengatasi|cara\s+mencegah|cara\s+menghindari)\b/i,
  ];

  /**
   * Kata sinyal darurat aktif. Jika ada, bypass edukatif tidak berlaku —
   * pesan dianggap laporan krisis, bukan pertanyaan informasi (VIMB-135).
   * Contuh tetap blok: "gimana kalau saya pendarahan banyak sekarang?"
   */
  private readonly urgencyPatterns: RegExp[] = [
    /\b(?:sekarang|segera|darurat|mendadak|tiba[\s-]?tiba)\b/i,
    /\b(?:tolong|tolongin|mohon\s*bantuan)\b/i,
    /\b(?:parah|hebat|deras|banyak|kritis)\b/i,
  ];

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

    // Detect educational/hypothetical framing — if present, skip the EMERGENCY
    // block so users can ask questions like "apakah pendarahan trimester 3 normal?"
    // Active emergencies ("tolong, saya pendarahan parah sekarang!") do NOT match
    // these patterns and continue to be blocked as expected.
    const hasUrgencySignal = this.urgencyPatterns.some((p) =>
      p.test(normalizedMessage),
    );
    const isEducationalQuestion =
      !hasUrgencySignal &&
      this.educationalPatterns.some((p) => p.test(normalizedMessage));

    for (const rule of this.rules) {
      // Educational questions are allowed to mention emergency symptoms
      // (they are asking for information, not reporting a crisis)
      if (
        isEducationalQuestion &&
        rule.blockReason === BLOCK_REASONS.EMERGENCY
      ) {
        continue;
      }

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
