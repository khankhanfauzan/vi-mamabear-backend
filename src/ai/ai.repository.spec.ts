import { Test, TestingModule } from '@nestjs/testing';
import { AiRepository } from './ai.repository';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';
import { AiRole } from '../generated/prisma';

describe('AiRepository', () => {
  let repository: AiRepository;
  let prisma: {
    aiMessage: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      aiMessage: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EmbeddingsService,
          useValue: {},
        },
      ],
    }).compile();

    repository = module.get<AiRepository>(AiRepository);
  });

  describe('createMessage', () => {
    it('should forward metadata to prisma.aiMessage.create data payload', async () => {
      const metadataPayload = { products: [{ id: 1, name: 'Sample Product' }] };
      prisma.aiMessage.create.mockResolvedValue({ id: 'msg-1' } as any);

      await repository.createMessage({
        conversationId: 'conv-123',
        role: AiRole.ASSISTANT,
        content: 'Sample content',
        metadata: metadataPayload,
      });

      expect(prisma.aiMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-123',
          role: AiRole.ASSISTANT,
          content: 'Sample content',
          blocked: false,
          blockReason: undefined,
          tokensUsed: 0,
          model: 'openrouter/default',
          metadata: metadataPayload,
        },
      });
    });
  });
});
