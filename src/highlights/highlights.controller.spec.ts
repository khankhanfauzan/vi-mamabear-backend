import { Test, TestingModule } from '@nestjs/testing';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';

describe('HighlightsController', () => {
  let controller: HighlightsController;

  const mockService = {
    getAllHighlights: jest.fn(),
    getHighlightById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HighlightsController],
      providers: [{ provide: HighlightsService, useValue: mockService }],
    }).compile();

    controller = module.get<HighlightsController>(HighlightsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
