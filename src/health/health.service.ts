import { Injectable } from '@nestjs/common';
import { getHeapStatistics } from 'node:v8';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async getHealth() {
    const dbStartTime = Date.now();
    let dbStatus = 'unhealthy';
    let dbMessage = 'Connection failed';
    let dbLatency = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStartTime;
      dbStatus =
        dbLatency < 50
          ? 'healthy'
          : dbLatency <= 150
            ? 'degraded'
            : 'unhealthy';
      dbMessage = 'Connection successful';
    } catch (error: unknown) {
      dbLatency = Date.now() - dbStartTime;
      dbMessage = error instanceof Error ? error.message : 'Connection failed';
    }

    // Compare used JS heap to V8's actual limit, not its currently allocated heap.
    const heapUsed = process.memoryUsage().heapUsed;
    const heapLimit = getHeapStatistics().heap_size_limit;
    const heapUsage = heapUsed / heapLimit;
    // Warn at 75%; report unhealthy at 90% of the V8 heap limit.
    const memoryStatus =
      heapUsage >= 0.9
        ? 'unhealthy'
        : heapUsage >= 0.75
          ? 'degraded'
          : 'healthy';

    const checks = {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        message: dbMessage,
      },
      memory: {
        status: memoryStatus,
        heapUsedMb: heapUsed / 1024 ** 2,
        heapLimitMb: heapLimit / 1024 ** 2,
        usagePercent: heapUsage * 100,
        message:
          memoryStatus === 'unhealthy'
            ? 'Heap usage at or above 90% of the V8 heap limit'
            : memoryStatus === 'degraded'
              ? 'Heap usage at or above 75% of the V8 heap limit'
              : 'Heap usage within limits',
      },
    };

    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    Object.values(checks).forEach((check) => {
      if (check.status === 'healthy') healthyCount++;
      else if (check.status === 'degraded') degradedCount++;
      else if (check.status === 'unhealthy') unhealthyCount++;
    });

    let overallStatus = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      service: {
        name: 'mamabear-backend',
        version: '0.0.1',
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      checks,
      summary: {
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
      },
    };
  }
}
