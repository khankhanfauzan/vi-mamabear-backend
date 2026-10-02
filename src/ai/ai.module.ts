import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { GuardrailService } from './guardrail/guardrail.service';
import { ProductScopeGuardrailService } from './guardrail/product-scope-guardrail.service';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';

@Module({
  imports: [AuthModule, PrismaModule, EmbeddingsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiRepository,
    OpenRouterClient,
    GuardrailService,
    ProductScopeGuardrailService,
  ],
  exports: [AiService],
})
export class AiModule {}
