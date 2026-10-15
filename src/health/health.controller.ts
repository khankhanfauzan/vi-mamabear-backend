import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}
  @Get()
  async health() {
    const health = await this.healthService.getHealth();
    if (
      health.status === 'unhealthy' ||
      Object.values(health.checks).some((check) => check.status === 'unhealthy')
    ) {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
