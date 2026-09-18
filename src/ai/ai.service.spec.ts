import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { GuardrailService } from './guardrail/guardrail.service';
import { PinoLogger } from 'pino-nestjs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiRole } from '@/generated/prisma';

describe('AiService', () => {
  let service: AiService;
  let aiRepo: jest.Mocked<AiRepository>;
  let openRouter: jest.Mocked<OpenRouterClient>;
  let guardrail: jest.Mocked<GuardrailService>;

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
    };

    const mockOpenRouter = {
      chat: jest.fn(),
    };

    const mockGuardrail = {
      check: jest.fn(),
      checkOutput: jest.fn(),
    };

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

  describe('chat', () => { it('should not duplicate the latest user message in AI prompt', async () => {
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
      } as any);

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
