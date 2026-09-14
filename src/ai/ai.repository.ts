import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AiRole } from '@/generated/prisma';

@Injectable()
export class AiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(userId: string) {
    return this.prisma.aiConversation.create({
      data: { userId },
    });
  }

  async findConversationById(conversationId: string, userId: string) {
    return this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
  }

  async findMessagesByConversation(conversationId: string, userId: string) {
    return this.prisma.aiMessage.findMany({
      where: {
        conversationId,
        conversation: { userId },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(params: {
    conversationId: string;
    role: AiRole;
    content: string;
    blocked?: boolean;
    blockReason?: string;
    tokensUsed?: number;
    model?: string;
  }) {
    return this.prisma.aiMessage.create({
      data: {
        conversationId: params.conversationId,
        role: params.role,
        content: params.content,
        blocked: params.blocked ?? false,
        blockReason: params.blockReason,
        tokensUsed: params.tokensUsed ?? 0,
        model: params.model ?? 'openrouter/default',
      },
    });
  }

  async updateConversationTimestamp(conversationId: string) {
    return this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  async countConversationsByUser(userId: string) {
    return this.prisma.aiConversation.count({
      where: { userId },
    });
  }

  async findConversationsByUser(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findMessagesByConversationId(conversationId: string, userId: string) {
    return this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
}
