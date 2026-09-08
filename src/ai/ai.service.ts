import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'pino-nestjs';
import { AiRepository } from './ai.repository';

@Injectable()
export class AiService {
  constructor(
    private readonly aiRepo: AiRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiService.name);
  }
}
