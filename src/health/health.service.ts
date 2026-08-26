import { Injectable } from '@nestjs/common';
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
    } catch (error: any) {
      dbLatency = Date.now() - dbStartTime;
      dbMessage = error.message;
    }

    // Mock storage health check as requested
    const storageLatency = 28; // Example latency
    const storageStatus =
      storageLatency < 50
        ? 'healthy'
        : storageLatency <= 150
          ? 'degraded'
          : 'unhealthy';
    const storageMessage = 'S3 accessible';

    const checks = {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        message: dbMessage,
      },
      storage: {
        status: storageStatus,
        latencyMs: storageLatency,
        message: storageMessage,
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
