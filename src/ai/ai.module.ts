import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRepository } from './ai.repository';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, AiRepository, OpenRouterClient],
  exports: [AiService],
})
export class AiModule {}
