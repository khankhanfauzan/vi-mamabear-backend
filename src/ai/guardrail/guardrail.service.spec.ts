import { Test, TestingModule } from '@nestjs/testing';
import { GuardrailService } from './guardrail.service';
import { BLOCK_REASONS } from './blocked-keywords';
import { GUARDRAIL_MESSAGES, pickHumanizedMessage } from './guardrail-messages';

describe('GuardrailService', () => {
  let service: GuardrailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GuardrailService],
    }).compile();

    service = module.get<GuardrailService>(GuardrailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Input Guardrail (check)', () => {
    describe('EMERGENCY_MEDICAL_QUERY', () => {
      const emergencyInputs = [
        'Anak saya kejang-kejang dan tidak sadarkan diri.',
        'Tolong, saya pendarahan hebat saat hamil 7 bulan.',
        'Bayi saya tersedak parah dan membiru.',
        'Suami saya tiba-tiba sesak napas parah dan megap-megap.',
        'Ibu hamil jatuh dari tangga dan perutnya terbentur keras.',
      ];

      it.each(emergencyInputs)('should block emergency input: %s', (input) => {
        const result = service.check(input);
        expect(result).not.toBeNull();
        expect(result?.blockReason).toBe(BLOCK_REASONS.EMERGENCY);
      });
    });

    describe('PRESCRIPTION_REQUEST', () => {
      const prescriptionInputs = [
        'Tolong resepkan amoksisilin untuk batuk anak saya.',
        'Berapa dosis paracetamol yang aman untuk bayi 6 bulan?',
        'Apa antibiotik yang cocok untuk radang tenggorokan ibu menyusui?',
        'Tuliskan resep obat kortikosteroid untuk asma.',
        'Apakah saya boleh konsumsi ibuprofen, dan berapa mg?',
      ];

      it.each(prescriptionInputs)(
        'should block prescription request: %s',
        (input) => {
          const result = service.check(input);
          expect(result).not.toBeNull();
          expect(result?.blockReason).toBe(BLOCK_REASONS.PRESCRIPTION);
        },
      );
    });

    describe('OUT_OF_SCOPE', () => {
      const outOfScopeInputs = [
        'Siapa presiden Indonesia saat ini?',
        'Rekomendasi saham yang bagus untuk investasi bulan ini?',
        'Film Netflix apa yang paling seru sekarang?',
        'Bagaimana skor pertandingan sepak bola tadi malam?',
        'Berapa prakiraan cuaca di Jakarta besok?',
      ];

      it.each(outOfScopeInputs)(
        'should block out of scope input: %s',
        (input) => {
          const result = service.check(input);
          expect(result).not.toBeNull();
          expect(result?.blockReason).toBe(BLOCK_REASONS.OUT_OF_SCOPE);
        },
      );
    });

    describe('Safe Inputs', () => {
      const safeInputs = [
        'Bagaimana cara membedakan tangisan bayi lapar dan ngantuk?',
        'Apa saja makanan sehat untuk ibu menyusui?',
        'Kenapa ASI saya sedikit?',
        'Gimana cara memperbanyak ASI?',
        'Bagaimana cara meningkatkan produksi ASI?',
        'ASI saya seret, apa yang harus saya lakukan?',
        'Bagaimana agar ASI lebih lancar saat menyusui?',
        'Berapa jam tidur yang ideal untuk bayi usia 1 bulan?',
        'Cara mengatasi puting lecet saat menyusui.',
        'Senam hamil yang aman di trimester kedua.',
      ];

      it.each(safeInputs)('should allow safe input: %s', (input) => {
        const result = service.check(input);
        expect(result).toBeNull();
      });
    });
  });

  describe('Output Guardrail (checkOutput)', () => {
    describe('MEDICAL_DIAGNOSIS', () => {
      const diagnosisOutputs = [
        'Diagnosis Anda adalah diabetes gestasional.',
        'Kemungkinan besar Anda mengalami pre-eklamsia ringan.',
        'Gejala ini menunjukkan Anda menderita anemia defisiensi besi.',
        'Penyakit ini adalah infeksi saluran kemih (ISK).',
        'Anda terkena flu Singapura melihat dari gejala tersebut.',
      ];

      it.each(diagnosisOutputs)(
        'should block medical diagnosis output: %s',
        (output) => {
          const result = service.checkOutput(output);
          expect(result).not.toBeNull();
          expect(result?.blockReason).toBe(BLOCK_REASONS.MEDICAL_DIAGNOSIS);
        },
      );
    });

    describe('SPECIFIC_PRESCRIPTION', () => {
      const prescriptionOutputs = [
        'Saya rekomendasikan obat Amoksisilin 500mg untuk kondisi ini.',
        'Silakan minum obat paracetamol 3 kali sehari.',
        'Konsumsi ibuprofen dosis 400mg jika nyeri perut.',
        'Dosis yang tepat adalah 1 sendok teh setiap 8 jam.',
        'Diminum 3 x sehari setelah makan ya.',
      ];

      it.each(prescriptionOutputs)(
        'should block specific prescription output: %s',
        (output) => {
          const result = service.checkOutput(output);
          expect(result).not.toBeNull();
          expect(result?.blockReason).toBe(BLOCK_REASONS.SPECIFIC_PRESCRIPTION);
        },
      );
    });

    describe('Safe Outputs', () => {
      const safeOutputs = [
        'Pastikan bayi mendapatkan ASI eksklusif selama 6 bulan pertama.',
        'Ibu hamil disarankan untuk makan makanan bergizi seimbang.',
        'Untuk menjaga produksi ASI, ibu perlu banyak minum air putih.',
        'Coba mandikan bayi dengan air hangat agar tidurnya lebih nyenyak.',
        'Lakukan pijat payudara dengan lembut sebelum menyusui.',
      ];

      it.each(safeOutputs)('should allow safe output: %s', (output) => {
        const result = service.checkOutput(output);
        expect(result).toBeNull();
      });
    });
  });

  describe('Humanized messages (VIMB-99)', () => {
    it('should provide at least 2 variations per guardrail category', () => {
      Object.values(GUARDRAIL_MESSAGES).forEach((options) => {
        expect(options.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should never return an empty message for any block reason', () => {
      Object.values(BLOCK_REASONS).forEach((reason) => {
        const message = pickHumanizedMessage(reason);
        expect(message.trim().length).toBeGreaterThan(0);
      });
    });

    it('should return a non-template humanized message on blocked input', () => {
      const result = service.check(
        'Anak saya kejang-kejang dan tidak sadarkan diri.',
      );

      expect(result).not.toBeNull();
      expect(result?.responseMessage).toBeTruthy();
      // Sapaan hangat khas MamaBear, bukan bahasa robotik
      expect(result?.responseMessage).toMatch(/\bMa\b|Mama/);
      expect(result?.responseMessage).not.toMatch(
        /Mohon maaf atas ketidaknyamanannya|Sistem kami tidak dapat/i,
      );
    });

    it('should return a non-template humanized message on blocked output', () => {
      const result = service.checkOutput(
        'Diagnosis Anda adalah diabetes gestasional.',
      );

      expect(result).not.toBeNull();
      expect(result?.responseMessage).toBeTruthy();
      expect(result?.responseMessage).toMatch(/\bMa\b|Mama/);
    });
  });

  describe('VIMB-98: Educational bypass for emergency guardrail (Bug #4)', () => {
    it('should NOT block educational question about trimester bleeding', () => {
      const result = service.check(
        'min kalau ada pendarahan di trimester 3 itu normal apa ngga?',
      );
      expect(result).toBeNull();
    });

    it('should NOT block "apakah pendarahan saat hamil itu bahaya?"', () => {
      const result = service.check('apakah pendarahan saat hamil itu bahaya?');
      expect(result).toBeNull();
    });

    it('should STILL block active emergency "tolong saya pendarahan parah sekarang"', () => {
      const result = service.check('tolong saya pendarahan parah sekarang');
      expect(result).not.toBeNull();
      expect(result?.blockReason).toBe(BLOCK_REASONS.EMERGENCY);
    });
  });

  describe('VIMB-98: Output guardrail false-positive fixes (Bug #2)', () => {
    it('should NOT block educational statement "Mama mengalami penurunan produksi ASI"', () => {
      const result = service.checkOutput(
        'Mama mengalami penurunan produksi ASI karena stres dan kurang cairan. Ini bisa diatasi dengan memperbanyak minum air putih dan menyusui lebih sering.',
      );
      expect(result).toBeNull();
    });

    it('should STILL block explicit disease diagnosis "Mama menderita diabetes gestasional"', () => {
      const result = service.checkOutput(
        'Mama menderita diabetes gestasional.',
      );
      expect(result).not.toBeNull();
      expect(result?.blockReason).toBe(BLOCK_REASONS.MEDICAL_DIAGNOSIS);
    });
  });

  describe('VIMB-135: dosis produk konteks vs resep obat', () => {
    const productDosageInputs = [
      'Berapa dosis produk pelancar ASI MamaBear?',
      'Dosis produk pelancar ASI MamaBear berapa ya?',
      'Berapa dosis suplemen pelancar ASI yang dianjurkan?',
      'Dosis yang tepat untuk produk pelancar ASI berapa?',
      'Dosis yang tepat untuk suplemen MamaBear berapa?',
      'Kalau produk pelancar ASI itu dosis berapa ya Ma?',
    ];

    it.each(productDosageInputs)(
      'should NOT block product dosage question: %s',
      (input) => {
        const result = service.check(input);
        expect(result).toBeNull();
      },
    );

    const drugDosageInputs = [
      'Berapa dosis paracetamol untuk bayi 6 bulan?',
      'Berapa dosis ibuprofen untuk ibu menyusui?',
      'Dosis yang aman untuk ibu hamil berapa?',
      'Dosis yang dianjurkan untuk ibu hamil berapa?',
    ];

    it.each(drugDosageInputs)(
      'should STILL block drug dosage question: %s',
      (input) => {
        const result = service.check(input);
        expect(result).not.toBeNull();
        expect(result?.blockReason).toBe(BLOCK_REASONS.PRESCRIPTION);
      },
    );

    it('should NOT block output mentioning product dosage', () => {
      const result = service.checkOutput(
        'Dosis produk pelancar ASI MamaBear bisa diberikan sesuai anjuran kemasan ya, Ma.',
      );
      expect(result).toBeNull();
    });

    it('should NOT block output "dosis yang tepat untuk produk"', () => {
      const result = service.checkOutput(
        'Dosis yang tepat untuk produk pelancar ASI adalah sesuai anjuran kemasan ya Ma.',
      );
      expect(result).toBeNull();
    });

    it('should STILL block output "dosis yang tepat" tanpa konteks produk', () => {
      const result = service.checkOutput(
        'Dosis yang tepat adalah 1 sendok teh setiap 8 jam.',
      );
      expect(result).not.toBeNull();
      expect(result?.blockReason).toBe(BLOCK_REASONS.SPECIFIC_PRESCRIPTION);
    });

    it('should STILL block output with drug dosage', () => {
      const result = service.checkOutput(
        'Dosis paracetamol yang tepat adalah 500 mg.',
      );
      expect(result).not.toBeNull();
      expect(result?.blockReason).toBe(BLOCK_REASONS.SPECIFIC_PRESCRIPTION);
    });
  });

  describe('VIMB-135: "gimana" tidak lagi lolos blokir darurat', () => {
    const urgentEmergencies = [
      'gimana kalau saya pendarahan banyak sekarang?',
      'gimana kalau bayi saya kejang terus sekarang?',
      'kenapa saya sesak napas parah, tolong bantu!',
    ];

    it.each(urgentEmergencies)(
      'should block urgent emergency despite "gimana/kenapa": %s',
      (input) => {
        const result = service.check(input);
        expect(result).not.toBeNull();
        expect(result?.blockReason).toBe(BLOCK_REASONS.EMERGENCY);
      },
    );

    it('should still allow educational question without urgency signal', () => {
      const result = service.check('apakah pendarahan saat hamil itu bahaya?');
      expect(result).toBeNull();
    });

    it('should still allow safe "gimana" question about ASI', () => {
      const result = service.check('Gimana cara memperbanyak ASI?');
      expect(result).toBeNull();
    });
  });

  describe('VIMB-135: pesan blok menyertakan kontak WA CS', () => {
    it('emergency block message should contain WA CS contact', () => {
      const result = service.check(
        'Anak saya kejang-kejang dan tidak sadarkan diri.',
      );
      expect(result?.responseMessage).toContain('https://wa.me/628888695757');
    });

    it('prescription block message should contain WA CS contact', () => {
      const result = service.check(
        'Tolong resepkan amoksisilin untuk batuk anak saya.',
      );
      expect(result?.responseMessage).toContain('https://wa.me/628888695757');
    });

    it('diagnosis block message should contain WA CS contact', () => {
      const result = service.checkOutput(
        'Mama menderita diabetes gestasional.',
      );
      expect(result?.responseMessage).toContain('https://wa.me/628888695757');
    });

    it('specific prescription block message should contain WA CS contact', () => {
      const result = service.checkOutput(
        'Dosis paracetamol yang tepat adalah 500 mg.',
      );
      expect(result?.responseMessage).toContain('https://wa.me/628888695757');
    });
  });
});
