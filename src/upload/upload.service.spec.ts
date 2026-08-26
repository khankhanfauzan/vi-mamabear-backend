import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { UploadRepository } from './upload.repository';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';

describe('UploadService', () => {
  let service: UploadService;

  const mockRepo = {
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };

  const mockCloudinary = {
    uploadFile: jest.fn(),
    uploadMultiple: jest.fn(),
    deleteFile: jest.fn(),
    generateUploadSignature: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: UploadRepository, useValue: mockRepo },
        { provide: CloudinaryService, useValue: mockCloudinary },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
