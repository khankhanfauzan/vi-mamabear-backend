import { Module } from '@nestjs/common';
import { HighlightsService } from './highlights.service';
import { HighlightsController } from './highlights.controller';
import { HighlightsAdminController } from './highlights-admin.controller';
import { HighlightsRepository } from './highlights.repository';

@Module({
  controllers: [HighlightsController, HighlightsAdminController],
  providers: [HighlightsService, HighlightsRepository],
})
export class HighlightsModule {}
