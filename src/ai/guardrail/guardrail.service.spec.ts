import { Test, TestingModule } from '@nestjs/testing';
import { GuardrailService } from './guardrail.service';
import { BLOCK_REASONS } from './blocked-keywords';

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
        'Rekomendasi obat untuk kondisi Anda adalah Amoksisilin 500mg.',
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
});
