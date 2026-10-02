/**
 * Health education keyword whitelist — if a message contains a health symptom/condition
 * AND a maternal/neonatal context word, it is an educational question, not a product query.
 * Covers common typos (e.g. "pendaraah").
 */
const HEALTH_SYMPTOM_KEYWORDS =
  /\b(?:pendarahan|perdarahan|pendaraah|kontraksi|mual|muntah|demam|sakit|nyeri|gatal|bengkak|pusing|lemas|kram|flek|darah|keguguran|operasi|cesar|caesar|infeksi|alergi|ruam|diare|sembelit|batuk|pilek|flu|normal|bahaya|aman|risiko|berbahaya|tanda|gejala|penyebab|kenapa|mengapa)\b/;

const MATERNAL_CONTEXT_KEYWORDS =
  /\b(?:hamil|kehamilan|trimester|menyusui|busui|bayi|janin|anak|melahirkan|persalinan|nifas|postpartum|asi|kandungan|rahim|kontrol|usg|bumil|busui|lahir)\b/;

/** Strip shopping language before embedding: embedding the entire chat dilutes identity. */
export function extractProductQueries(message: string): string[] {
  const text = message.toLowerCase().trim();
  const intent =
    /\b(?:jual|menjual|sedia|tersedia|stok|stock|ready|beli|membeli|harga|cari|mencari|punya|ada)\b/.test(
      text,
    );
  if (!intent) return [];

  // ── Health education whitelist (Bug #4 fix) ──────────────────────────────
  // Messages that contain a health/symptom keyword AND a maternal/neonatal
  // context word are educational questions, NOT product queries — even if they
  // happen to contain "ada", "cari", etc.
  // Example: "kalau ada pendaraah di trimester 3 itu normal apa ngga?" →  []
  if (HEALTH_SYMPTOM_KEYWORDS.test(text) && MATERNAL_CONTEXT_KEYWORDS.test(text)) {
    return [];
  }

  // ── Educational bypass (widened from start-of-string to anywhere) ────────
  // Users often prefix messages with greetings ("min", "kak", "ma") before
  // the actual question, so we cannot anchor these patterns to ^ only.
  if (
    /\b(?:bagaimana|gimana|kenapa|mengapa|cara|tips)\b/.test(text) ||
    /\bada\s+(?:cara|tips|saran)\b/.test(text) ||
    /\b(?:apa|apakah)\s+(?:penyebab|risiko|tanda|gejala|normal|aman|bahaya)\b/.test(text) ||
    /\b(?:normal|aman|bahaya|berbahaya)\s*(?:ga|gak|nggak|ngga|tidak|kah)?\b/.test(text)
  )
    return [];

  // ── "ada"-only intent guard ──────────────────────────────────────────────
  // "ada" in Indonesian has two meanings:
  //   (a) shopping: "ada produk pompa ASI?" → product query ✅
  //   (b) existential: "kalau ada pendarahan" → "if bleeding occurs" ❌
  // Only treat "ada" as product intent when paired with explicit shopping context.
  const hasOtherShoppingIntent =
    /\b(?:jual|menjual|sedia|tersedia|stok|stock|ready|beli|membeli|harga|cari|mencari|punya)\b/.test(
      text,
    );
  if (!hasOtherShoppingIntent) {
    // "ada" is the sole intent signal — require explicit product/shopping context
    const hasProductShoppingContext =
      /\bada\s+(?:produk|barang|item|stok|stock|varian|variant|ukuran|rasa|promo|diskon)\b/.test(
        text,
      ) ||
      /\bada\b.*\b(?:di\s*(?:mamabear|mama\s*bear|sini|katalog|toko)|harganya|stoknya)\b/.test(
        text,
      );
    if (!hasProductShoppingContext) return [];
  }
  let query = text
    .replace(
      /^(?:(?:halo|hai|min|admin|ma|mama|kak|apakah|berapa|mau|ingin|aku|saya|tolong)\s+)*(?:jual|menjual|beli|membeli|harga|cari|mencari|punya|ada)\b\s*/,
      '',
    )
    .replace(
      /\b(?:apakah|berapa|harga|harganya|stoknya|stock|stok|ready|tersedia|sedia|dijual|jual|menjual|beli|membeli|cari|mencari|punya|ada|ga|gak|nggak|enggak|kah|tidak|ya|yah|dong|min|admin|ma|mama|kak|kakak|sis|halo|hai|mau|ingin|butuh|kalian|kamu|kita|kami|anda|saya|aku)\b/g,
      ' ',
    )
    .replace(/\bdi\s+(?:mamabear|mama\s*bear|sini|katalog)\b/g, ' ')
    .replace(/[?!:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    /\bsesuatu\b/.test(query) ||
    /\bapa\s+(?:aja|saja)\b/.test(query) ||
    /^(?:rekomendasi\s+)?produk(?:\s+(?:untuk|buat|bagus|apa)\b.*)?$/.test(
      query,
    )
  )
    return [];
  query = query
    .replace(/\b(?:produk|rekomendasi)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  query = query.replace(/^(?:untuk|dong)\s+/, '');
  return query
    .split(/\s+(?:dan|atau|serta)\s+|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function productIdentityTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/mama\s+bear/g, 'mamabear')
      .replace(/breast\s+pump/g, 'pompa asi')
      .replace(
        /\b(?:merk|merek|brand|untuk|ibu|menyusui|hamil|bayi|si|kecil|yang|dengan|rasa|isi|sachet|saset|bpom|halal)\b/g,
        ' ',
      )
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/** All identity terms (including an explicitly requested brand) must be grounded. */
export function matchesProductIdentity(
  query: string,
  product: { name: string; tags: string[] },
): boolean {
  const requested = productIdentityTokens(query);
  const catalog = new Set(
    productIdentityTokens([product.name, ...product.tags].join(' ')),
  );
  return requested.length > 0 && requested.every((token) => catalog.has(token));
}
