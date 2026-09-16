import { GuardrailService } from './guardrail.service';
import { BLOCK_REASONS } from './blocked-keywords';

describe('GuardrailService', () => {
  let service: GuardrailService;

  beforeEach(() => {
    service = new GuardrailService();
  });

  // ─────────────────────────────────────────────────────────────────
  // Pesan aman (harus return null)
  // ─────────────────────────────────────────────────────────────────
  describe('check() → null (pesan aman)', () => {
    it('should return null for normal maternal health question', () => {
      expect(service.check('bayi saya susah tidur, apa yang harus dilakukan?')).toBeNull();
    });

    it('should return null for breastfeeding question', () => {
      expect(service.check('ASI saya kurang, bagaimana cara memperbanyak?')).toBeNull();
    });

    it('should return null for pregnancy nutrition question', () => {
      expect(service.check('makanan apa yang baik untuk ibu hamil trimester 3?')).toBeNull();
    });

    it('should return null for empty-ish safe message', () => {
      expect(service.check('halo, bisa bantu saya?')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Kategori 1: Darurat Medis → EMERGENCY_MEDICAL_QUERY
  // ─────────────────────────────────────────────────────────────────
  describe('check() → EMERGENCY_MEDICAL_QUERY', () => {
    const emergencyMessages = [
      'saya mengalami pendarahan yang sangat banyak',
      'ibu saya kejang tiba-tiba',
      'saya tidak bisa bernapas',
      'bayi saya tidak bergerak sama sekali',
      'saya keguguran sekarang',
      'tolong cepat, suami saya pingsan',
      'tanda-tanda eklamsia apa yang perlu segera ke IGD?',
      'sepertinya henti jantung, apa yang harus dilakukan?',
      'bayi saya demam di atas 40 derajat',
      'bayi saya kejang sudah 5 menit',
      'perlu panggil ambulans sekarang?',
    ];

    it.each(emergencyMessages)(
      'should block emergency message: "%s"',
      (msg) => {
        const result = service.check(msg);
        expect(result).not.toBeNull();
        expect(result!.blockReason).toBe(BLOCK_REASONS.EMERGENCY);
        expect(result!.responseMessage).toContain('IGD');
      },
    );

    it('should include WA MamaBear number in emergency response', () => {
      const result = service.check('terjadi pendarahan hebat');
      expect(result!.responseMessage).toContain('628888695757');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Kategori 2: Resep / Dosis → PRESCRIPTION_REQUEST
  // ─────────────────────────────────────────────────────────────────
  describe('check() → PRESCRIPTION_REQUEST', () => {
    const prescriptionMessages = [
      'berikan saya resep untuk batuk',
      'berapa dosis paracetamol untuk ibu hamil?',
      'bolehkah minum ibuprofen berapa mg saat menyusui?',
      'tolong resepkan antibiotik untuk saya',
      'takaran obat yang tepat untuk bayi 3 bulan',
      'obat keras apa yang aman untuk hamil?',
      'boleh konsumsi obat apa untuk demam saat menyusui?',
      'dosis amoksisilin untuk bayi 6 bulan berapa?',
    ];

    it.each(prescriptionMessages)(
      'should block prescription message: "%s"',
      (msg) => {
        const result = service.check(msg);
        expect(result).not.toBeNull();
        expect(result!.blockReason).toBe(BLOCK_REASONS.PRESCRIPTION);
        expect(result!.responseMessage).toContain('dokter');
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // Kategori 3: Di luar scope → OUT_OF_SCOPE
  // ─────────────────────────────────────────────────────────────────
  describe('check() → OUT_OF_SCOPE', () => {
    const outOfScopeMessages = [
      'siapa presiden Indonesia sekarang?',
      'saham apa yang bagus untuk dibeli?',
      'rekomendasikan film netflix yang bagus',
      'bagaimana cuaca hari ini di Jakarta?',
      'skor bola semalam berapa?',
      'rekomendasi laptop gaming murah',
      'tempat wisata bagus di Bali apa?',
    ];

    it.each(outOfScopeMessages)(
      'should block out-of-scope message: "%s"',
      (msg) => {
        const result = service.check(msg);
        expect(result).not.toBeNull();
        expect(result!.blockReason).toBe(BLOCK_REASONS.OUT_OF_SCOPE);
        expect(result!.responseMessage).toContain('ibu hamil');
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // Prioritas: EMERGENCY > PRESCRIPTION > OUT_OF_SCOPE
  // ─────────────────────────────────────────────────────────────────
  describe('check() → prioritas blok', () => {
    it('should prioritize EMERGENCY over PRESCRIPTION when both match', () => {
      // Pesan mengandung keyword darurat sekaligus dosis obat
      const result = service.check(
        'saya kejang dan butuh tahu dosis obat untuk berhenti kejang',
      );
      expect(result).not.toBeNull();
      expect(result!.blockReason).toBe(BLOCK_REASONS.EMERGENCY);
    });

    it('should prioritize PRESCRIPTION over OUT_OF_SCOPE when both match', () => {
      // Pesan out-of-scope tapi juga mengandung kata resep
      const result = service.check(
        'tolong resepkan obat untuk pemain bola yang cedera',
      );
      expect(result).not.toBeNull();
      expect(result!.blockReason).toBe(BLOCK_REASONS.PRESCRIPTION);
    });
  });
});
