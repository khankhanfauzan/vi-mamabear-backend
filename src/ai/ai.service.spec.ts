import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { PinoLogger } from 'pino-nestjs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GuardrailService } from './guardrail/guardrail.service';
import { BLOCK_REASONS } from './guardrail/blocked-keywords';

const mockAiRepo = {
  findConversationById: jest.fn(),
  countConversationsByUser: jest.fn(),
  findOldestConversationByUser: jest.fn(),
  deleteConversation: jest.fn(),
  createConversation: jest.fn(),
  createMessage: jest.fn(),
  findMessagesByConversation: jest.fn(),
  updateConversationTimestamp: jest.fn(),
  findConversationsByUser: jest.fn(),
  findMessagesByConversationId: jest.fn(),
};

const mockOpenRouter = {
  chat: jest.fn(),
};

const mockLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockGuardrail = {
  check: jest.fn(),
};

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiRepository, useValue: mockAiRepo },
        { provide: OpenRouterClient, useValue: mockOpenRouter },
        { provide: PinoLogger, useValue: mockLogger },
        { provide: GuardrailService, useValue: mockGuardrail },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // Helper: setup default happy-path mocks
  // ─────────────────────────────────────────────────────────────────
  function setupHappyPathMocks(conversationId = 'conv-new') {
    mockAiRepo.createConversation.mockResolvedValue({ id: conversationId });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.findMessagesByConversation.mockResolvedValue([]);
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});
    mockOpenRouter.chat.mockResolvedValue({
      content: 'Halo!',
      tokensUsed: 10,
      model: 'openrouter/test',
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Skenario 1: Pesan terlalu panjang
  // ─────────────────────────────────────────────────────────────────
  it('should throw BadRequestException when message exceeds 1000 characters', async () => {
    await expect(
      service.chat('user-1', { message: 'a'.repeat(1001) }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 2: conversationId tidak ditemukan
  // ─────────────────────────────────────────────────────────────────
  it('should throw NotFoundException when conversationId not found', async () => {
    mockAiRepo.findConversationById.mockResolvedValue(null);

    await expect(
      service.chat('user-1', { message: 'halo', conversationId: 'invalid-id' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 3: count < 50 — buat conversation baru, tanpa prune
  // ─────────────────────────────────────────────────────────────────
  it('should create new conversation when count < 50', async () => {
    mockAiRepo.countConversationsByUser.mockResolvedValue(10);
    setupHappyPathMocks();

    const result = await service.chat('user-1', { message: 'halo' });

    expect(mockAiRepo.countConversationsByUser).toHaveBeenCalledWith('user-1');
    expect(mockAiRepo.findOldestConversationByUser).not.toHaveBeenCalled();
    expect(mockAiRepo.deleteConversation).not.toHaveBeenCalled();
    expect(mockAiRepo.createConversation).toHaveBeenCalledWith('user-1');
    expect(result.success).toBe(true);
    expect(result.data.conversationId).toBe('conv-new');
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 4: count = 49 — tepat di bawah limit, tidak prune
  // ─────────────────────────────────────────────────────────────────
  it('should NOT auto-prune when count is exactly 49', async () => {
    mockAiRepo.countConversationsByUser.mockResolvedValue(49);
    setupHappyPathMocks();

    await service.chat('user-1', { message: 'halo' });

    expect(mockAiRepo.findOldestConversationByUser).not.toHaveBeenCalled();
    expect(mockAiRepo.deleteConversation).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 5: count = 50 — auto-prune yang terlama, lalu buat baru
  // ─────────────────────────────────────────────────────────────────
  it('should auto-prune oldest conversation when count reaches 50', async () => {
    const OLDEST_CONV_ID = 'conv-oldest';
    mockAiRepo.countConversationsByUser.mockResolvedValue(50);
    mockAiRepo.findOldestConversationByUser.mockResolvedValue({
      id: OLDEST_CONV_ID,
      userId: 'user-1',
      updatedAt: new Date('2024-01-01'),
    });
    mockAiRepo.deleteConversation.mockResolvedValue({ count: 1 });
    setupHappyPathMocks('conv-new-51');

    const result = await service.chat('user-1', { message: 'pesan ke-51' });

    // Verifikasi prune dipanggil dengan conversation terlama
    expect(mockAiRepo.findOldestConversationByUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(mockAiRepo.deleteConversation).toHaveBeenCalledWith(
      OLDEST_CONV_ID,
      'user-1',
    );

    // Verifikasi conversation baru tetap dibuat → jumlah tetap 50
    expect(mockAiRepo.createConversation).toHaveBeenCalledWith('user-1');

    // Verifikasi response sukses (tidak ada error ke user)
    expect(result.success).toBe(true);
    expect(result.data.conversationId).toBe('conv-new-51');
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 6: count > 50 (misalnya race condition: 51) — tetap prune
  // ─────────────────────────────────────────────────────────────────
  it('should auto-prune when count is greater than 50', async () => {
    mockAiRepo.countConversationsByUser.mockResolvedValue(51);
    mockAiRepo.findOldestConversationByUser.mockResolvedValue({
      id: 'conv-very-old',
      userId: 'user-1',
      updatedAt: new Date('2023-01-01'),
    });
    mockAiRepo.deleteConversation.mockResolvedValue({ count: 1 });
    setupHappyPathMocks();

    await service.chat('user-1', { message: 'halo' });

    expect(mockAiRepo.deleteConversation).toHaveBeenCalledWith(
      'conv-very-old',
      'user-1',
    );
    expect(mockAiRepo.createConversation).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 7: auto-prune log info dipanggil
  // ─────────────────────────────────────────────────────────────────
  it('should log info when auto-prune happens', async () => {
    mockAiRepo.countConversationsByUser.mockResolvedValue(50);
    mockAiRepo.findOldestConversationByUser.mockResolvedValue({
      id: 'conv-oldest',
      userId: 'user-1',
      updatedAt: new Date('2024-01-01'),
    });
    mockAiRepo.deleteConversation.mockResolvedValue({ count: 1 });
    setupHappyPathMocks();

    await service.chat('user-1', { message: 'halo' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user-1', deletedConversationId: 'conv-oldest' },
      'Auto-pruned oldest conversation to stay within limit',
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 8: conversationId valid — skip count check
  // ─────────────────────────────────────────────────────────────────
  it('should skip count check when valid conversationId provided', async () => {
    mockAiRepo.findConversationById.mockResolvedValue({
      id: 'conv-existing',
      userId: 'user-1',
    });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.findMessagesByConversation.mockResolvedValue([]);
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});
    mockOpenRouter.chat.mockResolvedValue({
      content: 'Halo!',
      tokensUsed: 5,
      model: 'openrouter/test',
    });

    const result = await service.chat('user-1', {
      message: 'lanjut chat',
      conversationId: 'conv-existing',
    });

    expect(mockAiRepo.countConversationsByUser).not.toHaveBeenCalled();
    expect(mockAiRepo.findOldestConversationByUser).not.toHaveBeenCalled();
    expect(mockAiRepo.createConversation).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data.conversationId).toBe('conv-existing');
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 9: chat berhasil → struktur response
  // ─────────────────────────────────────────────────────────────────
  it('should return correct ChatResponseDto on success', async () => {
    mockAiRepo.countConversationsByUser.mockResolvedValue(0);
    mockGuardrail.check.mockReturnValue(null); // aman, tidak diblok
    setupHappyPathMocks('conv-abc');

    const result = await service.chat('user-1', { message: 'halo' });

    expect(result).toEqual({
      success: true,
      message: 'Pesan berhasil diproses',
      data: {
        conversationId: 'conv-abc',
        reply: 'Halo!',
        blocked: false,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 10: Guardrail — pesan darurat medis
  // ─────────────────────────────────────────────────────────────────
  it('should block emergency medical message and NOT call OpenRouter', async () => {
    const emergencyResult = {
      blockReason: BLOCK_REASONS.EMERGENCY,
      responseMessage:
        'Kondisi ini mengindikasikan darurat medis, segera hubungi dokter/IGD terdekat atau WhatsApp MamaBear (628888695757).',
    };
    mockGuardrail.check.mockReturnValue(emergencyResult);
    mockAiRepo.createConversation.mockResolvedValue({ id: 'conv-blocked' });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});

    const result = await service.chat('user-1', {
      message: 'saya mengalami pendarahan banyak',
    });

    // OpenRouter tidak boleh dipanggil
    expect(mockOpenRouter.chat).not.toHaveBeenCalled();

    // Dua pesan disimpan: user (blocked) + assistant (guardrail response)
    expect(mockAiRepo.createMessage).toHaveBeenCalledTimes(2);
    expect(mockAiRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocked: true,
        blockReason: BLOCK_REASONS.EMERGENCY,
      }),
    );

    // Respons sesuai spesifikasi
    expect(result).toEqual({
      success: false,
      message: emergencyResult.responseMessage,
      data: {
        conversationId: 'conv-blocked',
        reply: null,
        blocked: true,
        blockReason: BLOCK_REASONS.EMERGENCY,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 11: Guardrail — permintaan resep obat
  // ─────────────────────────────────────────────────────────────────
  it('should block prescription request and NOT call OpenRouter', async () => {
    const prescriptionResult = {
      blockReason: BLOCK_REASONS.PRESCRIPTION,
      responseMessage:
        'Saya tidak dapat memberikan resep atau rekomendasi dosis obat. Silakan konsultasikan langsung dengan dokter atau apoteker Anda.',
    };
    mockGuardrail.check.mockReturnValue(prescriptionResult);
    mockAiRepo.createConversation.mockResolvedValue({ id: 'conv-rx' });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});

    const result = await service.chat('user-1', {
      message: 'tolong resepkan antibiotik untuk saya',
    });

    expect(mockOpenRouter.chat).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.data.blocked).toBe(true);
    expect(result.data.blockReason).toBe(BLOCK_REASONS.PRESCRIPTION);
    expect(result.data.reply).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 12: Guardrail — pesan di luar scope
  // ─────────────────────────────────────────────────────────────────
  it('should block out-of-scope message and NOT call OpenRouter', async () => {
    const outOfScopeResult = {
      blockReason: BLOCK_REASONS.OUT_OF_SCOPE,
      responseMessage:
        'Maaf, saya hanya bisa membantu pertanyaan seputar kesehatan ibu dan bayi. Untuk pertanyaan lain, silakan hubungi customer service kami.',
    };
    mockGuardrail.check.mockReturnValue(outOfScopeResult);
    mockAiRepo.createConversation.mockResolvedValue({ id: 'conv-oos' });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});

    const result = await service.chat('user-1', {
      message: 'siapa presiden Indonesia?',
    });

    expect(mockOpenRouter.chat).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.data.blocked).toBe(true);
    expect(result.data.blockReason).toBe(BLOCK_REASONS.OUT_OF_SCOPE);
    expect(result.data.reply).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 13: Guardrail blocked + conversationId valid ada
  // ─────────────────────────────────────────────────────────────────
  it('should use existing conversationId when guardrail blocks with valid conversationId', async () => {
    const emergencyResult = {
      blockReason: BLOCK_REASONS.EMERGENCY,
      responseMessage: 'Segera ke IGD.',
    };
    mockGuardrail.check.mockReturnValue(emergencyResult);
    mockAiRepo.findConversationById.mockResolvedValue({
      id: 'conv-existing',
      userId: 'user-1',
    });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});

    const result = await service.chat('user-1', {
      message: 'saya kejang',
      conversationId: 'conv-existing',
    });

    // createConversation tidak dipanggil karena conversationId sudah ada
    expect(mockAiRepo.createConversation).not.toHaveBeenCalled();
    expect(result.data.conversationId).toBe('conv-existing');
    expect(result.data.blocked).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // Skenario 14: Guardrail log warn dipanggil saat blok
  // ─────────────────────────────────────────────────────────────────
  it('should call logger.warn when guardrail blocks a message', async () => {
    const emergencyResult = {
      blockReason: BLOCK_REASONS.EMERGENCY,
      responseMessage: 'Segera ke IGD.',
    };
    mockGuardrail.check.mockReturnValue(emergencyResult);
    mockAiRepo.createConversation.mockResolvedValue({ id: 'conv-log' });
    mockAiRepo.createMessage.mockResolvedValue({});
    mockAiRepo.updateConversationTimestamp.mockResolvedValue({});

    await service.chat('user-1', { message: 'saya tidak sadar' });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      { userId: 'user-1', blockReason: BLOCK_REASONS.EMERGENCY },
      'Guardrail blocked message before LLM call',
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// Skenario deleteConversation
// ─────────────────────────────────────────────────────────────────
describe('AiService.deleteConversation', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiRepository, useValue: mockAiRepo },
        { provide: OpenRouterClient, useValue: mockOpenRouter },
        { provide: PinoLogger, useValue: mockLogger },
        { provide: GuardrailService, useValue: mockGuardrail },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  it('should return success on delete', async () => {
    mockAiRepo.deleteConversation.mockResolvedValue({ count: 1 });

    const result = await service.deleteConversation('user-1', 'conv-1');
    expect(result).toEqual({
      success: true,
      message: 'Percakapan berhasil dihapus.',
    });
  });

  it('should throw NotFoundException when conversation not found', async () => {
    mockAiRepo.deleteConversation.mockRejectedValue(
      new Error('CONVERSATION_NOT_FOUND'),
    );

    await expect(
      service.deleteConversation('user-1', 'invalid'),
    ).rejects.toThrow(NotFoundException);
  });
});
