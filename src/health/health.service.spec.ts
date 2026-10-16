import { getHeapStatistics } from 'node:v8';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('node:v8', () => ({ getHeapStatistics: jest.fn() }));

describe('HealthService', () => {
  const prisma = { $queryRaw: jest.fn() };
  let service: HealthService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 200,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });
    jest
      .mocked(getHeapStatistics)
      .mockReturnValue({ heap_size_limit: 1000 } as ReturnType<
        typeof getHeapStatistics
      >);
    service = new HealthService(prisma as unknown as PrismaService);
  });
  afterEach(() => jest.restoreAllMocks());

  it('pings the database with SELECT 1 and reports real memory instead of mock storage', async () => {
    const result = await service.getHealth();
    const [parts] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(parts.join('')).toBe('SELECT 1');
    expect(result.checks.database.status).toBe('healthy');
    expect(result.checks.memory).toMatchObject({
      status: 'healthy',
      usagePercent: 10,
    });
    expect(result.checks).not.toHaveProperty('storage');
    expect(result.status).toBe('healthy');
    expect(result.summary).toEqual({ healthy: 2, degraded: 0, unhealthy: 0 });
  });

  it('reports unhealthy when the database connection fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const result = await service.getHealth();
    expect(result.checks.database).toMatchObject({
      status: 'unhealthy',
      message: 'connection refused',
    });
    expect(result.checks.memory.status).toBe('healthy');
    expect(result.status).toBe('unhealthy');
    expect(result.summary).toEqual({ healthy: 1, degraded: 0, unhealthy: 1 });
  });

  it('handles a non-Error database rejection without losing the health response', async () => {
    prisma.$queryRaw.mockRejectedValue(null);
    const result = await service.getHealth();
    expect(result.checks.database.message).toBe('Connection failed');
    expect(result.status).toBe('unhealthy');
  });

  it.each([
    [49, 'healthy'],
    [50, 'degraded'],
    [150, 'degraded'],
    [151, 'unhealthy'],
  ] as const)(
    'preserves database latency policy at %dms (%s)',
    async (latency, status) => {
      jest
        .mocked(Date.now)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1000 + latency);
      const result = await service.getHealth();
      expect(result.checks.database).toMatchObject({
        latencyMs: latency,
        status,
      });
      expect(result.status).toBe(status);
    },
  );

  it.each([
    [749, 'healthy'],
    [750, 'degraded'],
    [899, 'degraded'],
    [900, 'unhealthy'],
  ] as const)(
    'uses real memory data at %d / 1000 bytes (%s)',
    async (heapUsed, status) => {
      jest.mocked(process.memoryUsage).mockReturnValue({
        rss: 1000,
        heapTotal: 1000,
        heapUsed,
        external: 0,
        arrayBuffers: 0,
      });
      const result = await service.getHealth();
      expect(result.checks.memory.status).toBe(status);
      expect(result.checks.memory.usagePercent).toBe(heapUsed / 10);
      expect(result.status).toBe(status);
    },
  );

  it('counts both unhealthy indicators', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('offline'));
    jest.mocked(process.memoryUsage).mockReturnValue({
      rss: 1000,
      heapTotal: 1000,
      heapUsed: 950,
      external: 0,
      arrayBuffers: 0,
    });
    const result = await service.getHealth();
    expect(result.summary).toEqual({ healthy: 0, degraded: 0, unhealthy: 2 });
  });

  it('retains service metadata', async () => {
    const result = await service.getHealth();
    expect(result.service).toMatchObject({
      name: 'mamabear-backend',
      version: '0.0.1',
    });
    expect(result.service.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(result.service.timestamp))).toBe(false);
  });
});
