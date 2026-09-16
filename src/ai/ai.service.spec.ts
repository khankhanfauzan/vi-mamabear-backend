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

  describe('chat', () => {
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
