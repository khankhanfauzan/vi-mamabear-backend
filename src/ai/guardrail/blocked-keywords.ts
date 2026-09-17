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
  MEDICAL_DIAGNOSIS: 'MEDICAL_DIAGNOSIS',
  SPECIFIC_PRESCRIPTION: 'SPECIFIC_PRESCRIPTION',
} as const;

export type BlockReason = (typeof BLOCK_REASONS)[keyof typeof BLOCK_REASONS];

// ─────────────────────────────────────────────────────────────
// 1. Gejala Darurat Medis
// ─────────────────────────────────────────────────────────────
export const EMERGENCY_MEDICAL_KEYWORDS: RegExp[] = [
  // Perdarahan
  /pendarahan/i,
  /berdarah\s*(banyak|terus|hebat|deras|parah)/i,
  /darah\s*(banyak|mengalir|keluar\s*terus|tidak\s*berhenti)/i,
  /keluar\s*darah\s*(banyak|terus|tiba[\s-]?tiba)/i,

  // Keselamatan jiwa
  /kejang/i,
  /tidak\s*sadar(kan\s*diri)?/i,
  /pingsan/i,
  /koma/i,
  /henti\s*jantung/i,
  /serangan\s*jantung/i,
  /jantung\s*berhenti/i,
  /detak\s*jantung\s*(hilang|berhenti|tidak\s*(teraba|terdeteksi|ada))/i,
  /jantung\s*bayi\s*(tidak\s*(terdeteksi|teraba|berdenyut)|berhenti)/i,
  /nadi\s*(tidak\s*ada|hilang|tidak\s*teraba)/i,

  // Pernapasan — diperluas tanpa qualifier wajib
  /sesak\s*napas\s*(parah|berat|mendadak|tiba[\s-]?tiba|sekali|banget)/i,
  /sesak\s*napas\s*(yang\s*)?(sangat|amat|luar\s*biasa)/i,
  /tidak\s*bisa\s*(bernapas|napas)/i,
  /susah\s*(bernapas|napas)\s*(parah|berat|banget|sekali)/i,
  /napas\s*(berhenti|tersengal[\s-]?sengal|megap|pendek\s*banget)/i,
  /napas\s*(bayi|mama|ibu)\s*(berhenti|tidak\s*ada|megap)/i,

  // Kehamilan darurat
  /keguguran/i,
  /janin\s*(tidak\s*bergerak|meninggal|mati|hilang\s*gerak)/i,
  /bayi\s*(tidak\s*bergerak|diam\s*saja|tidak\s*ada\s*gerakan)/i,
  /gerakan\s*bayi\s*(tidak\s*(ada|terasa)|berhenti|hilang)/i,
  /plasenta\s*(lepas|terlepas|previa\s*berdarah)/i,
  /kontraksi\s*(setiap\s*[1-3]\s*menit|sangat\s*kuat|tidak\s*berhenti|terus\s*menerus)/i,
  /melahirkan\s*(darurat|sekarang|mendadak|di\s*(jalan|rumah|mobil))/i,
  /kepala\s*bayi\s*(keluar|muncul|terlihat)/i,
  /air\s*ketuban\s*(pecah|keluar|bocor)\s*(dini|terlalu\s*cepat|prematur)/i,
  /ketuban\s*(pecah|keluar)\s*(dini|mendadak)/i,

  // Eklamsia / Pre-eklamsia berat
  /eklamsia/i,
  /pre[\s-]?eklamsia\s*(berat|parah)/i,
  /kejang\s*(saat|waktu)\s*(hamil|kehamilan)/i,

  // Keracunan / overdosis
  /overdosis/i,
  /keracunan\s*(parah|obat|makanan|bahan)/i,
  /menelan\s*(racun|bahan\s*berbahaya|obat\s*terlalu\s*banyak|cairan\s*berbahaya)/i,
  /tertelan\s*(racun|bahan\s*kimia|obat\s*banyak)/i,

  // Cedera parah
  /jatuh\s*(dari\s*(ketinggian|tangga|gedung)|keras|kepala\s*terbentur)/i,
  /kecelakaan\s*(parah|serius|berat|lalu\s*lintas)/i,
  /patah\s*tulang/i,
  /kepala\s*(terbentur|terpukul|terantuk)\s*(keras|parah|kuat)/i,

  // Bayi darurat — diperluas
  /bayi\s*(saya\s*)?(tidak\s*(bernapas|menangis|bergerak)|biru|tersedak\s*(parah|berat))/i,
  /bayi\s*(saya\s*)?demam\s*(di\s*atas\s*4[01]|>?\s*4[01])\s*(derajat)?/i,
  /bayi\s*(saya\s*)?demam\s*(tinggi\s*banget|sangat\s*tinggi|parah)/i,
  /bayi\s*(saya\s*)?kejang/i,
  /bayi\s*(saya\s*)?(tidak\s*mau\s*(minum|makan|menyusu)\s*(sama\s*sekali|parah)|lemas\s*sekali|tidak\s*responsif)/i,
  /bayi\s*(saya\s*)?biru\s*(di\s*(bibir|muka|wajah|tangan|seluruh\s*tubuh))?/i,
  /bibir\s*bayi\s*biru/i,

  // Gejala mendadak parah
  /tiba[\s-]?tiba\s*(pingsan|tidak\s*sadar|jatuh\s*pingsan|lemas\s*parah)/i,
  /mendadak\s*(tidak\s*sadar|kejang|pingsan|sesak)/i,
  /muntah\s*(darah|hitam|terus\s*menerus\s*parah)/i,
  /buang\s*air\s*(besar|kecil)\s*berdarah\s*(banyak|parah)/i,

  // Kata kunci umum darurat
  /darurat\s*medis/i,
  /ambulans/i,
  /\bigd\b/i,
  /gawat\s*darurat/i,
  /tolong\s*(cepat|segera|dokter|bantu)/i,
  /butuh\s*bantuan\s*(segera|cepat|dokter|medis)/i,
  /harus\s*ke\s*(igd|rumah\s*sakit|ugd)\s*(sekarang|segera)/i,
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
  /buatkan\s*(saya\s*)?resep/i,
  /kasih\s*(tahu\s*)?resep\s*obat/i,

  // Dosis — diperluas
  /berapa\s*(dosis|mg|ml|tablet|kapsul|sendok|tetes)/i,
  /dosis\s*(yang\s*)?(tepat|benar|aman|dianjurkan|harus|perlu)/i,
  /takaran\s*(obat|minum|konsumsi)/i,
  /anjuran\s*dosis/i,
  /berapa\s*kali\s*(minum|konsumsi|makan)\s*obat/i,
  /cara\s*(minum|konsumsi|pakai)\s*obat/i,

  // Obat keras / khusus resep
  /obat\s*keras/i,
  /antibiotik\s*(apa|yang|untuk|mana)/i,
  /amoksisilin/i,
  /metronidazol/i,
  /eritromisin/i,
  /klindamisin/i,
  /azitro(misin)?/i,
  /kortikosteroid/i,
  /steroid\s*(untuk|bayi|ibu\s*hamil)/i,
  /obat\s*resep/i,
  /obat\s*dokter/i,
  /ciprofloxacin/i,
  /misoprostol/i,
  /oksitosin/i,
  /deksametason/i,

  // Nama obat spesifik (any context)
  /(paracetamol|parasetamol|ibuprofen|asam\s*mefenamat|naproxen)\s*(berapa|dosis|mg|aman|boleh)/i,
  /(paracetamol|parasetamol|ibuprofen)\s*(untuk|buat)\s*(bayi|ibu\s*(hamil|menyusui|busui))/i,

  // Pertanyaan keamanan obat — diperluas
  /obat\s*(apa|mana)\s*(yang\s*)?(aman|boleh)\s*(untuk|buat)\s*(ibu\s*(hamil|menyusui|busui)|bayi)/i,
  /boleh\s*(minum|konsumsi|pakai)\s*obat\s*(apa|ini|tersebut|itu)/i,
  /aman\s*(gak|tidak|nggak|ngga)?\s*minum\s*obat\s*(ini|tersebut|itu|\w+)\s*(saat|waktu|kalau)\s*(hamil|menyusui|busui)/i,
  /apakah\s*boleh\s*(konsumsi|minum|pakai)\s*(obat|\w+)\s*(ini|tersebut|itu)\s*(saat|waktu)?\s*(hamil|menyusui|busui)/i,

  // Obat untuk ibu menyusui/hamil
  /obat\s*(penurun\s*panas|demam|batuk|pilek)\s*(untuk|buat|apa\s*yang\s*aman)\s*(ibu\s*(hamil|menyusui|busui)|bayi)/i,
  /obat\s*(apa|mana)\s*yang\s*aman\s*(di|saat|waktu|untuk)\s*(trimester|hamil|menyusui)/i,

  // Suplemen — diperluas
  /(vitamin|suplemen|zat\s*besi|asam\s*folat|kalsium|omega|dha)\s*(berapa|dosis|mg|takaran|tablet)/i,
  /berapa\s*(tablet|kapsul|ml)\s*(vitamin|suplemen|zat\s*besi|asam\s*folat)/i,
];

// ─────────────────────────────────────────────────────────────
// 3. Di Luar Scope Kesehatan Ibu & Bayi
// ─────────────────────────────────────────────────────────────
export const OUT_OF_SCOPE_KEYWORDS: RegExp[] = [
  // Politik & pemerintahan — diperluas
  /politik/i,
  /pemilu/i,
  /presiden/i,
  /calon\s*presiden/i,
  /wakil\s*presiden/i,
  /partai\s*politik/i,
  /pilkada/i,
  /pilpres/i,
  /anggota\s*(dpr|dprd|mpr|dewan)/i,
  /menteri\s*(apa|siapa|mana)/i,
  /kabinet/i,
  /gubernur/i,
  /walikota/i,
  /bupati/i,
  /berita\s*(politik|pemerintah|kpk|korupsi)/i,
  /kpk/i,
  /korupsi/i,

  // Keuangan & investasi — diperluas
  /investasi\s*(saham|kripto|forex|properti|emas)/i,
  /saham\s*(apa|yang|beli|jual|bagus|rekomendasi)/i,
  /kripto(currency)?/i,
  /bitcoin/i,
  /ethereum/i,
  /\bnft\b/i,
  /forex/i,
  /trading\s*(saham|forex|kripto|hari\s*ini)/i,
  /portofolio\s*investasi/i,
  /reksa\s*dana/i,
  /obligasi/i,
  /kurs\s*(dolar|rupiah|euro)/i,
  /harga\s*(emas|dolar|bitcoin)/i,

  // Hiburan non-relevan — diperluas
  /film\s*(apa|yang|bagus|terbaru|bioskop)/i,
  /\bnetflix\b/i,
  /\byoutube\b/i,
  /series\s*(netflix|disney|hbo|amazon)/i,
  /drama\s*(korea|jepang|thailand|taiwan)/i,
  /k[\s-]?drama/i,
  /anime\s*(apa|terbaik|terbaru)/i,
  /musik\s*(terbaru|hits|chart|rekomendasi)/i,
  /lagu\s*(terbaru|hits|apa|enak)/i,
  /artis\s*(siapa|itu|korea|indonesia)/i,
  /konser\s*(siapa|apa|tiket)/i,
  /spotify\s*(playlist|rekomendasi)/i,

  // Olahraga non-relevan — diperluas
  /skor\s*(bola|pertandingan|tadi\s*(malam|sore))/i,
  /liga\s*(inggris|champions|indonesia|premier)/i,
  /hasil\s*(pertandingan|bola|match)/i,
  /tim\s*(sepak\s*bola|olahraga)\s*(mana|apa)/i,
  /pemain\s*(bola|sepak\s*bola|basket)\s*(terbaik|siapa)/i,
  /klasemen\s*(liga|bola)/i,
  /transfer\s*(pemain|bola)/i,

  // Teknologi umum — diperluas
  /rekomendasi\s*(laptop|hp|handphone|smartphone|tablet|kamera)/i,
  /aplikasi\s*(terbaik|gaming|game|android|ios)/i,
  /game\s*(online|terbaru|terbaik|mobile)\s*(apa|yang)/i,
  /\bchatgpt\b/i,
  /\bai\s*(terbaik|rekomendasi|lain)/i,
  /cara\s*(hack|hacking|ngehack)/i,
  /software\s*(bajakan|cracked)/i,

  // Cuaca
  /cuaca\s*(hari\s*ini|besok|minggu\s*ini|di|sekarang)/i,
  /prakiraan\s*cuaca/i,
  /ramalan\s*cuaca/i,
  /hujan\s*(tidak|nggak)\s*(hari\s*ini|besok)/i,

  // Wisata & kuliner non-relevan
  /tempat\s*wisata/i,
  /destinasi\s*liburan/i,
  /hotel\s*(murah|bagus|di|bintang)/i,
  /rekomendasi\s*(restoran|tempat\s*makan|kafe|cafe)\s*(untuk|di|enak)/i,
  /wisata\s*(alam|kuliner|ke)/i,

  // Hukum umum — diperluas
  /hukum\s*(pidana|perdata|bisnis|internasional)/i,
  /cara\s*mengurus\s*(surat|akta|ktp|sim|stnk|paspor|visa)/i,
  /pajak\s*(penghasilan|kendaraan|ppn|pph)/i,
  /cara\s*(cerai|gugat|lapor\s*polisi)\s*(suami|istri)?/i,

  // Pekerjaan/karir non-relevan
  /lowongan\s*(kerja|pekerjaan)/i,
  /cara\s*(melamar|daftar)\s*kerja/i,
  /cv\s*(yang\s*baik|bagus|template)/i,

  // Belanja non-produk MamaBear
  /beli\s*(laptop|hp|tv|kulkas|motor|mobil)/i,
  /harga\s*(laptop|smartphone|kendaraan|motor|mobil)/i,
];

// ─────────────────────────────────────────────────────────────
// 4. Diagnosis Medis (Output Guardrail)
// ─────────────────────────────────────────────────────────────
export const OUTPUT_MEDICAL_DIAGNOSIS_KEYWORDS: RegExp[] = [
  // Diagnosis eksplisit — semua subjek
  /diagnosis\s*(anda|kamu|mama|ibu|kak)?\s*(anda|kamu|mama|ibu)?\s*adalah/i,
  /diagnosa\s*(anda|kamu|mama|ibu|kak)?\s*adalah/i,

  // "Anda/mama/ibu/kamu mengalami/menderita/terkena"
  /(anda|mama|ibu|kamu|kak)\s*(mengalami|menderita|terkena|didiagnosis|terindikasi)/i,

  // Gejala menunjukkan
  /gejala\s*(ini|tersebut|yang\s*anda|yang\s*mama|yang\s*kamu)\s*(ini\s*)?(menunjukkan|mengindikasikan|menandakan)/i,
  /gejala[\s\S]{0,30}menunjukkan/i,

  // Kemungkinan besar
  /kemungkinan\s*(besar)?\s*(anda|mama|ibu|kamu)\s*(mengalami|menderita|terkena)/i,
  /kemungkinan\s*besar\s*(ini|kondisi\s*ini)/i,

  // Ini adalah tanda/gejala dari
  /ini\s*adalah\s*(tanda|gejala|indikasi|kondisi)\s*(dari|bahwa)?/i,
  /(tanda|gejala|indikasi)\s*dari\s*(penyakit|kondisi|infeksi|gangguan)/i,

  // Penyakit ini adalah
  /penyakit\s*(ini|anda|mama|tersebut)\s*adalah/i,
  /kondisi\s*(ini|anda|mama|tersebut)\s*(adalah|menunjukkan|merupakan)/i,

  // Terindikasi
  /terindikasi\s*(mengalami|menderita|terkena|positif)/i,
  /positif\s*(mengidap|menderita|terkena)/i,
  /dipastikan\s*(mengalami|menderita|terkena)/i,

  // Ini menandakan kondisi
  /(ini|gejala\s*ini|kondisi\s*ini)\s*menandakan\s*(bahwa\s*)?(anda|mama|ibu|kamu)?/i,
  /menunjukkan\s*(adanya|bahwa)\s*(anda|mama|ibu)\s*(mengalami|menderita)/i,
];

// ─────────────────────────────────────────────────────────────
// 5. Rekomendasi Obat Spesifik (Output Guardrail)
// ─────────────────────────────────────────────────────────────
export const OUTPUT_PRESCRIPTION_KEYWORDS: RegExp[] = [
  // Rekomendasi obat
  /rekomendasi\s*obat/i,
  /saya\s*(rekomendasikan|sarankan)\s*obat/i,

  // Instruksi minum obat — diperluas (dengan/tanpa angka)
  /minum\s*obat/i,
  /harus\s*(minum|konsumsi|pakai)\s*obat/i,
  /silakan\s*(minum|konsumsi|gunakan)\s*obat/i,
  /diminum\s*[0-9]*\s*(x|kali|tablet|kapsul)/i,
  /diminum\s*(setiap|tiap|per)\s*(hari|malam|pagi|siang)/i,
  /dikonsumsi\s*[0-9]*\s*(x|kali|tablet|kapsul)/i,
  /dikonsumsi\s*(setiap|tiap|per)\s*(hari|malam|pagi|siang)/i,
  /diberikan\s*[0-9]+\s*(x|kali)\s*(sehari|per\s*hari)/i,
  /obat\s*ini\s*(harus|perlu|wajib)\s*(diminum|dikonsumsi|digunakan)/i,

  // Nama obat keras / resep dalam output
  /konsumsi\s*(paracetamol|parasetamol|ibuprofen|amoksisilin|antibiotik|asam\s*mefenamat|eritromisin|metronidazol|klindamisin|deksametason|kortikosteroid)/i,
  /(paracetamol|parasetamol|ibuprofen|amoksisilin|asam\s*mefenamat|eritromisin|metronidazol|klindamisin)\s*(\d+\s*mg|diminum|dikonsumsi|dosis)/i,
  /minum\s*(paracetamol|parasetamol|ibuprofen|amoksisilin|antibiotik|asam\s*mefenamat)/i,

  // Dosis eksplisit
  /\bdosis\b/i,
  /dosis\s*(yang\s*)?(tepat|aman|dianjurkan|sesuai|benar)/i,
  /\d+\s*mg\s*(per|setiap|tiap)\s*(hari|dosis|minum)/i,

  // Anjuran frekuensi / jadwal minum obat
  /[0-9]+\s*x\s*(sehari|per\s*hari)\s*(setelah|sebelum)\s*makan/i,
  /setiap\s*[0-9]+\s*jam\s*(sekali|minum|konsumsi)/i,
  /obat\s*ini\s*[0-9]+\s*(tablet|kapsul|sendok)\s*(per|tiap|setiap)\s*(hari|malam|pagi)/i,
];
