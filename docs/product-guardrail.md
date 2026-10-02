# Guardrail keberadaan produk

Pemeriksaan dilakukan setelah guardrail medis/input dan sebelum `OpenRouterClient.chat`.
Respons blok memakai bentuk API guardrail yang sudah ada (`success: false`, pesan di
`message`, `reply: null`, `products: []`). Riwayat menyimpan pesan pengganti yang aman.
`ProductScopeGuardrailService.validateProductQuery` juga tersedia untuk caller yang
sudah memiliki draft: draft dibuang jika katalog tidak mendukung produk tersebut.

## Kebijakan katalog

- Pertanyaan transaksi/availability spesifik diperiksa; edukasi dan pertanyaan katalog
  umum tetap diproses normal. Ekstraksi memakai aturan deterministik bahasa Indonesia,
  sehingga paraphrase baru harus ditambahkan sebagai regression case.
- Semua produk yang disebut dengan `dan`, `atau`, `serta`, atau koma harus lolos.
- Nama/tag literal dari produk aktif menjadi bukti langsung, termasuk produk yang
  embedding-nya belum diisi. Produk tidak aktif tidak dipakai sebagai bukti.
- Untuk kandidat semantik: embedding hanya frasa produk, model yang sama dengan
  `EmbeddingsService` (`liquid/lfm-2.5-embedding-350m:free`, 1024 dimensi), pgvector
  cosine similarity `1 - (embedding <=> query_vector)`, maksimum 20 kandidat aktif.
- Skor harus >= `PRODUCT_MATCH_THRESHOLD` DAN semua istilah identitas harus ada
  pada nama/tag kandidat. Deskripsi/kategori tidak menjadi bukti identitas karena
  satu topik ASI dapat mencakup banyak produk yang berbeda. Merek yang disebut
  eksplisit juga wajib cocok. Alias resmi bisa ditambahkan ke tag katalog.
- Pengecekan layanan gagal menghasilkan `PRODUCT_CATALOG_UNAVAILABLE`; pesan tidak
  menyatakan produk absen. Kecocokan kosong/di bawah threshold menghasilkan
  `PRODUCT_OUT_OF_SCOPE`. Keduanya menawarkan bantuan tanpa mengarang kategori.

## Threshold dan status verifikasi

Default **0.75 masih provisional**, mengikuti contoh requirement, **bukan hasil
kalibrasi katalog aktual**. Test mock membuktikan keputusan tepat di batas (0.75
diterima, 0.7499 ditolak), bukan akurasi embedding. Jangan menganggap test mock
sebagai bukti bahwa threshold telah disetujui atau tidak ada false positive.

Sebelum staging/release, jalankan kalibrasi read-only:

1. Siapkan JSON berisi minimal 3 query positif dari katalog aktual dan minimal 3
   query negatif yang dikonfirmasi tim. Label ditetapkan dari katalog, bukan dari
   skor. Pompa ASI/kantong ASI hanya negatif jika benar-benar tidak dijual.
2. Jalankan `node scripts/calibrate-product-guardrail.mjs path/to/cases.json`.
   Script menggunakan `.env` yang sudah dikonfigurasi dan mengeluarkan skor aktual,
   kandidat, matriks keputusan, dan rekomendasi threshold. Tidak mengubah database.
3. Jika rentang skor positif/negatif bertumpuk, tidak ada threshold tunggal yang
   memisahkan seluruh kasus; perbaiki embedding/tag/alias atau kebijakan identitas
   dahulu, lalu ulangi. Hindari sekadar menaikkan angka hingga produk valid diblok.
4. Simpan output bertanggal, snapshot/version katalog, model embedding, serta
   approval reviewer. Set `PRODUCT_MATCH_THRESHOLD` sesuai hasil yang disetujui.
5. QA endpoint chat di staging, termasuk nama setiap produk aktif, alias resmi,
   salah merek, kombinasi produk valid+fiktif, edukasi, dan kegagalan embedding/DB.
   Pastikan respons blok hangat, tidak ada kartu produk, dan tidak ada pemanggilan LLM.

Format kasus:

```json
[
  { "query": "Jual AlmonMix ga?", "expected": true },
  { "query": "Jual kantong ASI ga Min?", "expected": false }
]
```

Unit test memakai tiga nama produk dari `prisma/data.ts`: AlmonMix, Teh Pelancar
ASI, ASI Booster Kapsul. Ini data seed, bukan bukti katalog staging/produksi saat ini.
Review manusia, kalibrasi aktual, dan QA manual staging harus dicatat terpisah.
