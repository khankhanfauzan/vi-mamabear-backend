import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  const mockPrisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('reports healthy status when the database query succeeds quickly', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getHealth();

      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.database.message).toBe('Connection successful');
      expect(result.checks.storage.status).toBe('healthy');
      expect(result.status).toBe('healthy');
      expect(result.summary).toEqual({ healthy: 2, degraded: 0, unhealthy: 0 });
    });

    it('reports unhealthy overall status when the database query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      const result = await service.getHealth();

      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.message).toBe('connection refused');
      expect(result.status).toBe('unhealthy');
      expect(result.summary.unhealthy).toBe(1);
    });

    it('includes service metadata in the response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getHealth();

      expect(result.service.name).toBe('mamabear-backend');
      expect(result.service.version).toBe('0.0.1');
      expect(typeof result.service.uptimeSeconds).toBe('number');
    });
  });
});
