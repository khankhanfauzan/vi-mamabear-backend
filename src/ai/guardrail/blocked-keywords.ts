/**
 * Konstanta keyword/regex untuk guardrail AI MamaBear.
 *
 * Tiga kategori blok:
 *  1. EMERGENCY_MEDICAL_QUERY  — gejala darurat medis
 *  2. PRESCRIPTION_REQUEST     — permintaan resep atau dosis obat
 *  3. OUT_OF_SCOPE             — pertanyaan di luar scope kesehatan ibu & bayi
 */

export const BLOCK_REASONS = {
  EMERGENCY: 'EMERGENCY_MEDICAL_QUERY',
  PRESCRIPTION: 'PRESCRIPTION_REQUEST',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;

export type BlockReason = (typeof BLOCK_REASONS)[keyof typeof BLOCK_REASONS];

// ─────────────────────────────────────────────────────────────
// 1. Gejala Darurat Medis
// ─────────────────────────────────────────────────────────────
export const EMERGENCY_MEDICAL_KEYWORDS: RegExp[] = [
  // Perdarahan
  /pendarahan/i,
  /berdarah\s*(banyak|terus|hebat|deras)/i,
  /darah\s*(banyak|mengalir|keluar\s*terus)/i,

  // Keselamatan jiwa
  /kejang/i,
  /tidak\s*sadar(kan\s*diri)?/i,
  /pingsan/i,
  /koma/i,
  /henti\s*jantung/i,
  /serangan\s*jantung/i,
  /jantung\s*berhenti/i,
  /detak\s*jantung\s*(hilang|berhenti|tidak\s*(teraba|terdeteksi))/i,

  // Pernapasan
  /sesak\s*napas\s*(parah|berat|mendadak|tiba[\s-]?tiba)/i,
  /tidak\s*bisa\s*(bernapas|napas)/i,
  /napas\s*(berhenti|tersengal[\s-]?sengal|megap)/i,

  // Kehamilan darurat
  /keguguran/i,
  /janin\s*(tidak\s*bergerak|meninggal|mati)/i,
  /bayi\s*tidak\s*bergerak/i,
  /plasenta\s*(lepas|terlepas|previa\s*berdarah)/i,
  /kontraksi\s*(setiap\s*[1-3]\s*menit|sangat\s*kuat|tidak\s*berhenti)/i,
  /melahirkan\s*(darurat|sekarang|mendadak)/i,
  /kepala\s*bayi\s*(keluar|muncul)/i,

  // Eklamsia / Pre-eklamsia berat
  /eklamsia/i,
  /pre[\s-]?eklamsia\s*berat/i,
  /kejang\s*(saat|waktu)\s*(hamil|kehamilan)/i,

  // Keracunan / overdosis
  /overdosis/i,
  /keracunan\s*(parah|obat|makanan\s*parah)/i,
  /menelan\s*(racun|bahan\s*berbahaya|obat\s*terlalu\s*banyak)/i,

  // Cedera parah
  /jatuh\s*(dari\s*(ketinggian|tangga)|keras|kepala\s*terbentur)/i,
  /kecelakaan\s*(parah|serius|berat)/i,
  /patah\s*tulang/i,

  // Bayi darurat
  /bayi\s*(saya\s*)?(tidak\s*(bernapas|menangis|bergerak)|biru|tersedak\s*parah)/i,
  /bayi\s*(saya\s*)?demam\s*(di\s*atas\s*4[01]|>?\s*4[01])\s*(derajat)?/i,
  /bayi\s*(saya\s*)?kejang/i,

  // Kata kunci umum darurat
  /darurat\s*medis/i,
  /ambulans/i,
  /igd/i,
  /gawat\s*darurat/i,
  /tolong\s*(cepat|segera|dokter)/i,
];

// ─────────────────────────────────────────────────────────────
// 2. Permintaan Resep / Dosis Obat
// ─────────────────────────────────────────────────────────────
export const PRESCRIPTION_KEYWORDS: RegExp[] = [
  // Resep langsung
  /resepkan/i,
  /berikan\s*(saya\s*)?resep/i,
  /tulis(kan)?\s*resep/i,
  /minta\s*(saya\s*)?resep/i,

  // Dosis
  /berapa\s*(dosis|mg|ml|tablet|kapsul|sendok)/i,
  /dosis\s*(yang\s*)?(tepat|benar|aman|dianjurkan)/i,
  /takaran\s*obat/i,
  /anjuran\s*dosis/i,

  // Obat keras / khusus resep
  /obat\s*keras/i,
  /antibiotik\s*(apa|yang|untuk)/i,
  /amoksisilin/i,
  /metronidazol/i,
  /eritromisin/i,
  /kortikosteroid/i,
  /steroid\s*(untuk|bayi|ibu\s*hamil)/i,
  /obat\s*resep/i,
  /obat\s*dokter/i,

  // Nama obat spesifik + konteks dosis
  /(paracetamol|parasetamol|ibuprofen|asam\s*mefenamat|naproxen)\s*(berapa|dosis|mg)/i,
  /obat\s*(apa|mana)\s*(yang\s*)?(aman|boleh)\s*(untuk|buat)\s*(ibu\s*hamil|menyusui|bayi)/i,
  /boleh\s*(minum|konsumsi)\s*obat\s*(apa|ini|tersebut)/i,

  // Suplemen resep
  /(vitamin|suplemen|zat\s*besi|asam\s*folat)\s*(berapa|dosis|mg|takaran)/i,
];

// ─────────────────────────────────────────────────────────────
// 3. Di Luar Scope Kesehatan Ibu & Bayi
// ─────────────────────────────────────────────────────────────
export const OUT_OF_SCOPE_KEYWORDS: RegExp[] = [
  // Politik & pemerintahan
  /politik/i,
  /pemilu/i,
  /presiden/i,
  /partai\s*politik/i,
  /pilkada/i,
  /pilpres/i,
  /anggota\s*dpr/i,

  // Keuangan & investasi
  /investasi\s*(saham|kripto|forex)/i,
  /saham\s*(apa|yang|beli|jual)/i,
  /kripto(currency)?/i,
  /bitcoin/i,
  /forex/i,
  /trading\s*(saham|forex|kripto)/i,
  /portofolio\s*investasi/i,

  // Hiburan non-relevan
  /film\s*(apa|yang|bagus|terbaru)/i,
  /netflix/i,
  /series\s*(netflix|disney|hbo)/i,
  /drama\s*(korea|jepang|thailand)/i,
  /musik\s*(terbaru|hits|chart)/i,
  /lagu\s*(terbaru|hits|apa)/i,
  /artis\s*(siapa|itu)/i,

  // Olahraga non-relevan
  /skor\s*(bola|pertandingan)/i,
  /liga\s*(inggris|champions|indonesia)/i,
  /hasil\s*pertandingan/i,
  /tim\s*(sepak\s*bola|olahraga)\s*(mana|apa)/i,

  // Teknologi umum
  /rekomendasi\s*(laptop|hp|handphone|smartphone)/i,
  /aplikasi\s*(terbaik|gaming|game)/i,

  // Cuaca
  /cuaca\s*(hari\s*ini|besok|minggu\s*ini|di)/i,
  /prakiraan\s*cuaca/i,
  /ramalan\s*cuaca/i,

  // Wisata
  /tempat\s*wisata/i,
  /destinasi\s*liburan/i,
  /hotel\s*(murah|bagus|di)/i,
  /rekomendasi\s*(restoran|tempat\s*makan)\s*(untuk|di)/i,

  // Hukum umum
  /hukum\s*(pidana|perdata|bisnis)/i,
  /cara\s*mengurus\s*(surat|akta|ktp|sim|stnk)/i,
  /pajak\s*(penghasilan|kendaraan)/i,
];
