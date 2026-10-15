import { HttpException, HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PinoLogger } from 'pino-nestjs';
import request from 'supertest';
import { getHeapStatistics } from 'node:v8';
import { AllExceptionsFilter } from '@/common/filters/exceptions.filter';
import { TransformInterceptor } from '@/common/interceptors/transformer.interceptor';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('node:v8', () => ({ getHeapStatistics: jest.fn() }));

describe('HealthController', () => {
  let app: INestApplication;
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
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
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    controller = module.get(HealthController);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(
      new AllExceptionsFilter({
        error: jest.fn(),
        warn: jest.fn(),
      } as unknown as PinoLogger),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('returns HTTP 200 when database and memory are healthy', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 200,
      data: {
        status: 'healthy',
        checks: {
          database: { status: 'healthy' },
          memory: { status: 'healthy' },
        },
      },
    });
    expect(response.body.data.checks).not.toHaveProperty('storage');
  });

  it('returns HTTP 503 when the database connection is lost', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);
    expect(response.body).toMatchObject({ success: false, statusCode: 503 });
  });

  it('returns HTTP 503 when memory is unhealthy even if the database is healthy', async () => {
    jest.mocked(process.memoryUsage).mockReturnValue({
      rss: 1000,
      heapTotal: 1000,
      heapUsed: 900,
      external: 0,
      arrayBuffers: 0,
    });
    await request(app.getHttpServer()).get('/api/health').expect(503);
  });

  it('keeps HTTP 200 for a degraded check', async () => {
    jest.mocked(process.memoryUsage).mockReturnValue({
      rss: 1000,
      heapTotal: 1000,
      heapUsed: 800,
      external: 0,
      arrayBuffers: 0,
    });
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body).toMatchObject({ data: { status: 'degraded' } });
  });

  it('throws a 503 HttpException carrying the health result for direct callers', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('offline'));
    let caught: unknown;
    try {
      await controller.health();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((caught as HttpException).getResponse()).toMatchObject({
      status: 'unhealthy',
      checks: { database: { status: 'unhealthy' } },
    });
  });
});
