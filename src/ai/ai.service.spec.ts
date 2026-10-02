import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { GuardrailService } from './guardrail/guardrail.service';
import { ProductScopeGuardrailService } from './guardrail/product-scope-guardrail.service';
import { PinoLogger } from 'pino-nestjs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiRole } from '@/generated/prisma';

describe('AiService', () => {
  let service: AiService;
  let aiRepo: jest.Mocked<AiRepository>;
  let openRouter: jest.Mocked<OpenRouterClient>;
  let guardrail: jest.Mocked<GuardrailService>;
  let productGuardrail: { check: jest.Mock };

  beforeEach(async () => {
    const mockAiRepo = {
      findConversationById: jest.fn(),
      createConversation: jest.fn(),
      createMessage: jest.fn(),
      updateConversationTimestamp: jest.fn(),
      countConversationsByUser: jest.fn(),
      findOldestConversationByUser: jest.fn(),
      deleteConversation: jest.fn(),
      findMessagesByConversation: jest.fn(),
      findConversationsByUser: jest.fn(),
      findMessagesByConversationId: jest.fn(),
      getActiveProductsForContext: jest.fn().mockResolvedValue([]),
      findProductsByIds: jest.fn().mockResolvedValue([]),
      findProductsBySemanticSearch: jest.fn().mockResolvedValue([]),
    };

    const mockOpenRouter = {
      chat: jest.fn(),
    };

    const mockGuardrail = {
      check: jest.fn(),
      checkOutput: jest.fn(),
    };
    productGuardrail = { check: jest.fn().mockResolvedValue(null) };

    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiRepository, useValue: mockAiRepo },
        { provide: OpenRouterClient, useValue: mockOpenRouter },
        { provide: GuardrailService, useValue: mockGuardrail },
        { provide: ProductScopeGuardrailService, useValue: productGuardrail },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    aiRepo = module.get(AiRepository);
    openRouter = module.get(OpenRouterClient);
    guardrail = module.get(GuardrailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chat', () => {
    it('blocks an absent product before LLM generation and records only the safe answer', async () => {
      productGuardrail.check.mockResolvedValue({
        blockReason: 'PRODUCT_OUT_OF_SCOPE',
        responseMessage:
          'Aku belum menemukan produk itu, Ma. Mau aku bantu cari alternatif?',
      });
      aiRepo.findConversationById.mockResolvedValue({ id: 'conv-1' } as never);
      const result = await service.chat('user-1', {
        conversationId: 'conv-1',
        message: 'Jual kantong ASI ga Min?',
      });
      expect(result.data).toMatchObject({
        blocked: true,
        blockReason: 'PRODUCT_OUT_OF_SCOPE',
        products: [],
        reply: null,
      });
      expect(openRouter.chat).not.toHaveBeenCalled();
      expect(aiRepo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: AiRole.ASSISTANT,
          blocked: true,
          content: result.message,
        }),
      );
      expect(aiRepo.getActiveProductsForContext).not.toHaveBeenCalled();
    });
    it('should not duplicate the latest user message in AI prompt', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([
        {
          id: 'msg-1',
          createdAt: new Date(),
          conversationId: 'conv-1',
          role: AiRole.USER,
          content: 'hello',
          blocked: false,
          blockReason: null,
          tokensUsed: 0,
          model: '',
          metadata: null,
        },
      ]);

      openRouter.chat.mockResolvedValue({
        content: 'AI response',
        tokensUsed: 10,
        model: 'mock-model',
      });

      await service.chat('user-1', { message: 'hello' });

      const messages = openRouter.chat.mock.calls[0][0];

      const userMessages = messages.filter(
        (message: { role: string; content: string }) =>
          message.role === 'user' && message.content === 'hello',
      );

      expect(userMessages).toHaveLength(1);
    });

    it('should include tone-of-voice instruction in system prompt (VIMB-99)', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
      openRouter.chat.mockResolvedValue({
        content: 'Halo Ma!',
        tokensUsed: 5,
        model: 'mock-model',
      });

      await service.chat('user-1', { message: 'halo' });

      const messages = openRouter.chat.mock.calls[0][0] as {
        role: string;
        content: string;
      }[];
      const systemPrompt = messages.find((m) => m.role === 'system')?.content;

      expect(systemPrompt).toContain('TONE OF VOICE');
      expect(systemPrompt).toContain('hangat');
      expect(systemPrompt).toContain('emoji');
    });

    it('should throw BadRequestException if message length > 1000', async () => {
      const longMessage = 'a'.repeat(1001);
      await expect(
        service.chat('user-1', { message: longMessage }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block message and return if input guardrail fails', async () => {
      guardrail.check.mockReturnValue({
        blockReason: 'EMERGENCY_MEDICAL_QUERY',
        responseMessage: 'Blocked by input guardrail',
      });

      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.chat('user-1', {
        message: 'darurat medis!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Blocked by input guardrail');
      expect(aiRepo.createMessage).toHaveBeenCalledTimes(2); // user and assistant mock responses
    });

    it('should process chat successfully when safe', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);

      openRouter.chat.mockResolvedValue({
        content: 'AI response',
        tokensUsed: 10,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', { message: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data?.reply).toContain('AI response');
      expect(result.data?.reply).toContain(
        'Catatan: Informasi ini bersifat edukatif',
      );
      expect(openRouter.chat).toHaveBeenCalled();
      expect(aiRepo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: AiRole.USER,
          content: 'hello',
        }),
      );
    });

    it('should append disclaimer only once even when products are recommended', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
      aiRepo.findProductsByIds.mockResolvedValue([
        {
          id: 1,
          name: 'Teh Pelancar ASI',
          slug: 'teh-pelancar-asi',
          category: 'Herbal',
          imageUrl: 'https://example.com/image.jpg',
          price: 50000,
          formattedPrice: 'Rp50.000',
          rating: 4.8,
          reviewCount: 120,
          totalSold: 500,
          shortDescription: 'Teh herbal',
        },
      ]);

      openRouter.chat.mockResolvedValue({
        content: 'Ini teh yang cocok untuk Mama. [PRODUCT_IDS: 1]',
        tokensUsed: 15,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'rekomendasi teh',
      });

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(1);
      expect(result.data?.reply).not.toContain('[PRODUCT_IDS:');
      const disclaimerMatches =
        result.data?.reply?.match(
          /Catatan: Informasi ini bersifat edukatif/g,
        ) || [];
      expect(disclaimerMatches).toHaveLength(1);
      expect(aiRepo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: AiRole.ASSISTANT,
          metadata: {
            products: expect.arrayContaining([
              expect.objectContaining({ id: 1, name: 'Teh Pelancar ASI' }),
            ]),
          },
        }),
      );
    });

    it('should sanitize English reasoning preamble and extract product into products property', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
      aiRepo.getActiveProductsForContext.mockResolvedValue([
        {
          id: 5,
          name: 'MamaBear ASI Booster 30 Kapsul',
          ingredients: null,
          description: null,
          categoryName: 'Kapsul',
          price: 75000,
        },
      ]);
      aiRepo.findProductsByIds.mockResolvedValue([
        {
          id: 5,
          name: 'MamaBear ASI Booster 30 Kapsul',
          slug: 'mamabear-asi-booster-30-kapsul',
          category: 'Kapsul',
          imageUrl: 'https://example.com/kapsul.jpg',
          price: 75000,
          formattedPrice: 'Rp75.000',
          rating: 4.9,
          reviewCount: 300,
          totalSold: 1200,
          shortDescription: 'Kapsul pelancar ASI',
        },
      ]);

      openRouter.chat.mockResolvedValue({
        content: `The user is asking about a capsule form of ASI booster.
I need to check the provided product data to see if there's a capsule product.

Looking at the data:
- ID 1: AlmonMix
- ID 5: MamaBear ASI Booster 30 Kapsul - Pelancar ASI Fenugreek Free

Yes, ID 5 is the capsule product: "MamaBear ASI Booster 30 Kapsul - Pelancar ASI Fenugreek Free"`,
        tokensUsed: 50,
        model: 'nvidia/nemotron-3.5-lightning:free',
      });

      const result = await service.chat('user-1', {
        message: 'ada yang bentuk kapsul?',
      });

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(1);
      expect(result.data?.products[0].id).toBe(5);
      expect(result.data?.reply).not.toContain('The user is asking');
      expect(result.data?.reply).not.toContain('Looking at the data');
      expect(result.data?.reply).not.toContain('- ID 1:');
      expect(result.data?.reply).toContain('Halo Ma!');
      expect(result.data?.reply).toContain('MamaBear ASI Booster 30 Kapsul');
    });

    it('should strip product ID mentions from reply while keeping product cards (VIMB-94)', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
      aiRepo.getActiveProductsForContext.mockResolvedValue([
        {
          id: 3,
          name: 'MamaBear Teh Pelancar ASI',
          ingredients: null,
          description: null,
          categoryName: 'Herbal',
          price: 50000,
        },
        {
          id: 5,
          name: 'MamaBear ASI Booster 30 Kapsul',
          ingredients: null,
          description: null,
          categoryName: 'Kapsul',
          price: 75000,
        },
      ]);
      aiRepo.findProductsByIds.mockResolvedValue([
        {
          id: 3,
          name: 'MamaBear Teh Pelancar ASI',
          slug: 'mamabear-teh-pelancar-asi',
          category: 'Herbal',
          imageUrl: '',
          price: 50000,
          formattedPrice: 'Rp50.000',
          rating: 4.8,
          reviewCount: 120,
          totalSold: 500,
          shortDescription: 'Teh herbal',
        },
        {
          id: 5,
          name: 'MamaBear ASI Booster 30 Kapsul',
          slug: 'mamabear-asi-booster-30-kapsul',
          category: 'Kapsul',
          imageUrl: '',
          price: 75000,
          formattedPrice: 'Rp75.000',
          rating: 4.9,
          reviewCount: 300,
          totalSold: 1200,
          shortDescription: 'Kapsul pelancar ASI',
        },
      ]);

      openRouter.chat.mockResolvedValue({
        content:
          'Halo Ma! Kami rekomendasikan MamaBear Teh Pelancar ASI (ID 3) dan MamaBear ASI Booster 30 Kapsul (ID: 5) untuk melancarkan ASI Mama.',
        tokensUsed: 20,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'rekomendasi pelancar ASI',
      });

      expect(result.success).toBe(true);
      expect(result.data?.reply).not.toMatch(/\(?\bID\b\s*[:#]?\s*\d+/i);
      expect(result.data?.reply).toContain('MamaBear Teh Pelancar ASI');
      expect(result.data?.reply).toContain('MamaBear ASI Booster 30 Kapsul');
      // Fallback ekstraksi tanpa tag tetap menghasilkan kartu produk
      expect(result.data?.products).toHaveLength(2);
    });

    it('should keep [PRODUCT_IDS] extraction working while removing ID text from reply (VIMB-94)', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
      aiRepo.findProductsByIds.mockResolvedValue([
        {
          id: 3,
          name: 'MamaBear Teh Pelancar ASI',
          slug: 'mamabear-teh-pelancar-asi',
          category: 'Herbal',
          imageUrl: '',
          price: 50000,
          formattedPrice: 'Rp50.000',
          rating: 4.8,
          reviewCount: 120,
          totalSold: 500,
          shortDescription: 'Teh herbal',
        },
      ]);

      openRouter.chat.mockResolvedValue({
        content:
          'Halo Ma! MamaBear Teh Pelancar ASI (ID 3) cocok untuk ASI seret.\n[PRODUCT_IDS: 3]',
        tokensUsed: 20,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', { message: 'ASI seret' });

      expect(result.success).toBe(true);
      expect(result.data?.reply).not.toContain('[PRODUCT_IDS:');
      expect(result.data?.reply).not.toMatch(/\(?\bID\b\s*[:#]?\s*\d+/i);
      expect(result.data?.products).toHaveLength(1);
      expect(result.data?.products?.[0].id).toBe(3);
    });

    it('should block message and return if output guardrail fails', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue({
        blockReason: 'MEDICAL_DIAGNOSIS',
        responseMessage: 'Blocked by output guardrail',
      });

      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);

      openRouter.chat.mockResolvedValue({
        content: 'Diagnosis Anda adalah diabetes.',
        tokensUsed: 10,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'apa penyakit saya?',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Blocked by output guardrail');
      expect(aiRepo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: AiRole.ASSISTANT,
          content: 'Blocked by output guardrail',
          blocked: true,
        }),
      );
    });
  });

  describe('clarification detection', () => {
    const setupMocks = () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue(null);
      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
    };

    it('should return type=clarification when LLM responds with [CLARIFY] prefix', async () => {
      setupMocks();
      openRouter.chat.mockResolvedValue({
        content:
          '[CLARIFY] Boleh cerita dulu, Ma, lagi cari produk untuk kebutuhan apa? Misalnya pelancar ASI, nutrisi kehamilan, atau camilan sehat? 😊',
        tokensUsed: 15,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'ada produk apa aja?',
      });

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('clarification');
    });

    it('should strip [CLARIFY] prefix completely from reply text', async () => {
      setupMocks();
      openRouter.chat.mockResolvedValue({
        content: '[CLARIFY] Kebutuhannya lebih ke menyusui atau nutrisi, Ma?',
        tokensUsed: 10,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'rekomendasiin dong',
      });

      expect(result.data?.reply).not.toMatch(/^\[CLARIFY\]/);
      expect(result.data?.reply).toContain('Kebutuhannya');
    });

    it('should return empty products and skip findProductsByIds when clarification', async () => {
      setupMocks();
      openRouter.chat.mockResolvedValue({
        content: '[CLARIFY] Untuk usia berapa bulan, Ma?',
        tokensUsed: 10,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'produk buat bayi',
      });

      expect(result.data?.products).toHaveLength(0);
      expect(aiRepo.findProductsByIds).not.toHaveBeenCalled();
    });

    it('should return type=answer for a specific non-ambiguous product query', async () => {
      setupMocks();
      openRouter.chat.mockResolvedValue({
        content: 'Halo Ma! Tersedia pompa ASI elektrik dari MamaBear.',
        tokensUsed: 10,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'ada pompa ASI elektrik ga?',
      });

      expect(result.data?.type).toBe('answer');
    });

    it('should respect output guardrail before clarification shortcut — blocked response wins', async () => {
      guardrail.check.mockReturnValue(null);
      guardrail.checkOutput.mockReturnValue({
        blockReason: 'MEDICAL_DIAGNOSIS',
        responseMessage: 'Blocked by output guardrail',
      });
      aiRepo.countConversationsByUser.mockResolvedValue(1);
      aiRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      aiRepo.findMessagesByConversation.mockResolvedValue([]);
      openRouter.chat.mockResolvedValue({
        content: '[CLARIFY] Boleh tau usianya berapa, Ma?',
        tokensUsed: 5,
        model: 'mock-model',
      });

      const result = await service.chat('user-1', {
        message: 'produk apa aja',
      });

      // Output guardrail lebih prioritas dari clarification detection
      expect(result.success).toBe(false);
      expect(result.message).toBe('Blocked by output guardrail');
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history including recommended products from metadata', async () => {
      const mockProduct = {
        id: 1,
        name: 'Teh Pelancar ASI',
        slug: 'teh-pelancar-asi',
        category: 'Herbal',
        imageUrl: 'https://example.com/image.jpg',
        price: 50000,
        formattedPrice: 'Rp50.000',
        rating: 4.8,
        reviewCount: 120,
        totalSold: 500,
        shortDescription: 'Teh herbal',
      };

      aiRepo.findMessagesByConversationId.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-1',
            role: AiRole.USER,
            content: 'Halo',
            blocked: false,
            blockReason: null,
            tokensUsed: 0,
            model: 'user',
            metadata: null,
            createdAt: new Date(),
          },
          {
            id: 'msg-2',
            conversationId: 'conv-1',
            role: AiRole.ASSISTANT,
            content: 'Halo Mama, ini rekomendasi produk.',
            blocked: false,
            blockReason: null,
            tokensUsed: 20,
            model: 'mock-model',
            metadata: { products: [mockProduct] },
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.getConversationHistory('conv-1', 'user-1');

      expect(result.id).toBe('conv-1');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].products).toEqual([]);
      expect(result.messages[1].products).toHaveLength(1);
      expect(result.messages[1].products[0].name).toBe('Teh Pelancar ASI');
    });

    it('should throw NotFoundException if conversation not found', async () => {
      aiRepo.findMessagesByConversationId.mockResolvedValue(null);

      await expect(
        service.getConversationHistory('conv-not-found', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation successfully', async () => {
      aiRepo.deleteConversation.mockResolvedValue({ count: 1 });

      const result = await service.deleteConversation('user-1', 'conv-1');
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      aiRepo.deleteConversation.mockRejectedValue(
        new Error('CONVERSATION_NOT_FOUND'),
      );

      await expect(
        service.deleteConversation('user-1', 'conv-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
