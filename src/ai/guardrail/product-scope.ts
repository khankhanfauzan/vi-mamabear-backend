/** Strip shopping language before embedding: embedding the entire chat dilutes identity. */
export function extractProductQueries(message: string): string[] {
  const text = message.toLowerCase().trim();
  const intent =
    /\b(?:jual|menjual|sedia|tersedia|stok|stock|ready|beli|membeli|harga|cari|mencari|punya|ada)\b/.test(
      text,
    );
  if (!intent) return [];
  // Broad catalog requests and educational questions should still reach the LLM.
  if (
    /^(?:bagaimana|gimana|kenapa|mengapa|cara|tips)\b/.test(text) ||
    /^ada\s+(?:cara|tips|saran)\b/.test(text) ||
    /^apa\s+(?:penyebab|risiko)\b/.test(text)
  )
    return [];
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
