/**
 * Pesan guardrail humanize, dipisahkan dari decision logic (guardrail.service).
 * Minimal 2 variasi per kategori agar tidak terasa template/berulang.
 * Kunci mengikuti nilai BLOCK_REASONS.
 */
export const GUARDRAIL_MESSAGES = {
  PRODUCT_OUT_OF_SCOPE: [
    'Aku belum menemukan produk yang Mama cari di katalog MamaBear ya, Ma 🙏 Mau aku bantu lihat produk lain yang tersedia di katalog sesuai kebutuhan Mama?',
    'Untuk produk yang Mama tanyakan, aku belum menemukan pilihan yang sesuai di katalog kita, Ma. Boleh cerita kebutuhan Mama? Aku siap bantu cari alternatif dari produk yang tersedia 😊',
  ],
  PRODUCT_CATALOG_UNAVAILABLE: [
    'Aku belum bisa memastikan produk itu di katalog saat ini ya, Ma 🙏 Coba tanyakan lagi sebentar, atau aku bantu informasi seputar kebutuhan Mama dulu?',
    'Katalog kita belum bisa aku cek sekarang, Ma. Mama bisa coba lagi sebentar ya. Sambil menunggu, aku siap bantu informasi seputar menyusui atau kebutuhan si kecil 😊',
  ],
  EMERGENCY_MEDICAL_QUERY: [
    'Waduh, ini sepertinya darurat ya, Ma 🙏 Cepat hubungi dokter/IGD terdekat atau WhatsApp MamaBear di 628888695757 agar segera ditangani, ya.',
    'Kayaknya perlu penanganan segera nih, Ma. Tolong langsung hubungi dokter/IGD terdekat atau WhatsApp MamaBear (628888695757) sekarang juga ya 🙏',
  ],
  PRESCRIPTION_REQUEST: [
    'Aku belum bisa meresepkan obat atau menentukan dosis ya, Ma 🙏 Untuk keamanan Mama & si kecil, konsultasikan langsung dengan dokter atau apoteker ya.',
    'Maaf ya, Ma, urusan resep dan dosis obat sebaiknya serahkan pada dokter atau apoteker supaya aman. Aku bantu cari info kesehatan lain boleh banget 😊',
  ],
  OUT_OF_SCOPE: [
    'Hmm, topik itu di luar yang bisa aku bantu ya, Ma 🙏 Tapi aku senang bantu seputar kehamilan, menyusui, perawatan bayi, atau produk MamaBear — mau tanya apa lagi?',
    'Waduh, aku belum bisa bantu jawab yang itu, Ma. Yuk tanya-tanya soal ASI, kehamilan, atau produk MamaBear, aku siap bantu kok!',
  ],
  MEDICAL_DIAGNOSIS: [
    'Aku belum bisa memberikan diagnosis ya, Ma 🙏 Sebaiknya Mama konsultasi langsung ke dokter agar penanganannya tepat dan aman untuk Mama & si kecil 💛',
    'Untuk diagnosis medis, dokter yang paling tepat memastikannya ya, Ma. Aku bantu cari informasi kesehatan ibu & bayi lainnya boleh banget 😊',
  ],
  SPECIFIC_PRESCRIPTION: [
    'Maaf ya, Ma, aku belum bisa merekomendasikan obat atau dosis spesifik 🙏 Yuk konsultasikan ke dokter atau apoteker supaya aman untuk Mama & si kecil.',
    'Urusan dosis obat sebaiknya ditanyakan ke dokter atau apoteker ya, Ma 💛 Aku bantu info seputar kesehatan lainnya kapan saja kok.',
  ],
} as const;

export type GuardrailMessageKey = keyof typeof GUARDRAIL_MESSAGES;

/** Pilih variasi pesan guardrail secara acak. */
export function pickHumanizedMessage(key: GuardrailMessageKey): string {
  const options = GUARDRAIL_MESSAGES[key];
  return options[Math.floor(Math.random() * options.length)];
}
