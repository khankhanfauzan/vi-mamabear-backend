import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { PinoLogger } from 'pino-nestjs';

@ApiTags('ai')
@ApiBearerAuth('JwtAuthGuard')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiController.name);
  }
}
