import { Test, TestingModule } from '@nestjs/testing';
import { HighlightsService } from './highlights.service';
import { HighlightsRepository } from './highlights.repository';

describe('HighlightsService', () => {
  let service: HighlightsService;

  const mockRepo = {
    findAll: jest.fn(),
    create: jest.fn(),
    findBySlug: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HighlightsService,
        { provide: HighlightsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<HighlightsService>(HighlightsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
