import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from './variant.service';
import { VariantRepository } from './variant.repository';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';

describe('VariantService', () => {
  let service: VariantService;

  const mockRepo = {};
  const mockCloudinary = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariantService,
        { provide: VariantRepository, useValue: mockRepo },
        { provide: CloudinaryService, useValue: mockCloudinary },
      ],
    }).compile();

    service = module.get<VariantService>(VariantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
