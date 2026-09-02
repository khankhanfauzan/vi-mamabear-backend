# Design Note: AI-Powered Health Assistant — MamaBear Backend

## Overview

MamaBear adalah platform e-commerce yang fokus pada produk ibu dan bayi. Sprint 2 ini menambahkan **fitur AI Assistant** yang bisa membantu pengguna dengan pertanyaan seputar kesehatan ibu hamil, menyusui, dan perawatan bayi — dengan **guardrail medis** agar jawaban tetap aman dan tidak berbahaya.

## Goals

1. Pengguna bisa bertanya seputar kesehatan ibu & bayi langsung dari aplikasi
2. AI hanya memberikan informasi umum — **bukan diagnosis atau pengganti dokter**
3. Semua percakapan tersimpan untuk audit dan perbaikan layanan
4. Guardrail medis memblokir pertanyaan berisiko tinggi

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Frontend   │────▶│  Backend API     │────▶│  OpenRouter   │
│  (Chat UI)  │◀────│  (NestJS Module) │◀────│  (LLM API)   │
└─────────────┘     └──────────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (Chat History)│
                    └──────────────┘
```

### Components

| Component | Responsibility |
|---|---|
| **AI Controller** | Endpoint REST: `/ai/chat`, `/ai/history` |
| **AI Service** | Orchestrate: validasi → guardrail → call LLM → simpan |
| **Guardrail Service** | Cek input/output sebelum & sesudah LLM call |
| **Chat Repository** | CRUD percakapan ke database |
| **OpenRouter Client** | HTTP client ke OpenRouter API |

## Data Model (Prisma Schema)

```prisma
model AiConversation {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String      @db.Uuid
  user        User        @relation(fields: [userId], references: [id])
  messages    AiMessage[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model AiMessage {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversationId  String          @db.Uuid
  conversation    AiConversation  @relation(fields: [conversationId], references: [id])
  role            AiRole
  content         String
  blocked         Boolean         @default(false)
  blockReason     String?
  tokensUsed      Int             @default(0)
  model           String          @default("openrouter/default")
  createdAt       DateTime        @default(now())
}

enum AiRole {
  USER
  ASSISTANT
  SYSTEM
}
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ai/chat` | Kirim pesan, dapatkan jawaban AI |
| `GET` | `/ai/history/:conversationId` | Ambil riwayat percakapan |
| `GET` | `/ai/conversations` | List semua percakapan user |
| `DELETE` | `/ai/conversations/:id` | Hapus percakapan |

### Request — POST /ai/chat

```json
{
  "conversationId": "optional-uuid",
  "message": "Apakah aman minum vitamin saat hamil trimester 1?"
}
```

### Response

```json
{
  "success": true,
  "message": "Pesan berhasil diproses",
  "data": {
    "conversationId": "uuid",
    "reply": "Vitamin prenatal umumnya aman diminum saat hamil trimester 1...",
    "blocked": false
  }
}
```

## Guardrail Medis

Guardrail adalah lapisan keamanan yang memastikan AI tidak memberikan informasi berbahaya.

### Input Guardrails (sebelum ke LLM)

| Rule | Action |
|---|---|
| Pertanyaan mengandung gejala darurat (sesak nafas, pendarahan) | **Block** → Sarankan hubungi IGD |
| Permintaan resep obat / dosis | **Block** → Sarankan konsultasi dokter |
| Pertanyaan di luar scope (kesehatan ibu & bayi) | **Redirect** → "Saya hanya bisa membantu seputar kesehatan ibu dan bayi" |

### Output Guardrails (setelah dari LLM)

| Rule | Action |
|---|---|
| Jawaban mengandung diagnosis medis | **Block** → Ganti dengan disclaimer |
| Jawaban mengandung rekomendasi obat spesifik | **Block** → Sarankan konsultasi dokter |
| Jawaban terlalu panjang | **Truncate** → Max 500 karakter |

### System Prompt

```
Kamu adalah asisten kesehatan untuk MamaBear, platform produk ibu dan bayi.

Batasan kamu:
- Hanya jawab pertanyaan seputar kesehatan ibu hamil, menyusui, dan perawatan bayi
- JANGAN pernah memberikan diagnosis medis
- JANGAN merekomendasikan obat atau dosis spesifik
- Selalu sarankan untuk berkonsultasi dengan dokter untuk masalah serius
- Gunakan bahasa Indonesia yang mudah dipahami
- Jawaban maksimal 3-4 kalimat

Jika pengguna bertanya di luar scope, balas:
"Maaf, saya hanya bisa membantu pertanyaan seputar kesehatan ibu dan bayi. Untuk pertanyaan lain, silakan hubungi customer service kami."
```

## OpenRouter Integration

### Configuration

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

### Request Flow

```
User Message
    │
    ▼
Input Guardrail Check
    │
    ├── BLOCKED → Return blocked response
    │
    ▼
Build Prompt (system + history + user message)
    │
    ▼
Call OpenRouter API (POST /chat/completions)
    │
    ▼
Output Guardrail Check
    │
    ├── BLOCKED → Return blocked response
    │
    ▼
Save to Database
    │
    ▼
Return Response
```

## Environment Variables

```env
# AI Configuration
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Guardrail
AI_MAX_TOKENS=500
AI_MAX_INPUT_LENGTH=1000
```

## File Structure

```
src/ai/
├── ai.module.ts
├── ai.controller.ts
├── ai.controller.spec.ts
├── ai.service.ts
├── ai.service.spec.ts
├── ai.repository.ts
├── guardrail/
│   ├── guardrail.service.ts
│   ├── guardrail.service.spec.ts
│   └── blocked-keywords.ts
├── openrouter/
│   ├── openrouter.client.ts
│   └── openrouter.client.spec.ts
└── dto/
    ├── chat.dto.ts
    └── chat-response.dto.ts
```

## Error Handling

| Error | HTTP Status | Message |
|---|---|---|
| Input terlalu panjang | 400 | "Pesan terlalu panjang. Maksimal 1000 karakter." |
| Input mengandung konten berbahaya | 400 | "Pesan diblokir oleh sistem keamanan." |
| OpenRouter API error | 502 | "AI sedang tidak tersedia. Silakan coba lagi nanti." |
| Rate limit exceeded | 429 | "Terlalu banyak permintaan. Silakan tunggu sebentar." |

## Rate Limiting

- Max **10 pesan per menit** per user (menggunakan ThrottlerModule yang sudah ada)
- Max **50 percakapan aktif** per user

## Testing Strategy

1. **Unit tests** — Guardrail logic, service methods
2. **Mock OpenRouter** — Jangan hit API asli di test
3. **Guardrail test cases** — Minimal 5 variasi kalimat per rule
4. **Manual E2E test** — Chat via Postman/frontend

## Future Considerations

- Streaming response (SSE) untuk UX lebih baik
- Voice input/output
- Multi-language support
- Integration dengan produk MamaBear (rekomendasi produk AI)
- Analytics dashboard untuk melihat pertanyaan populer
