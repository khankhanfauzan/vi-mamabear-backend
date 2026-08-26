// To be used for /health response

export enum HealthStatus {
  HEALTHY,
  DEGRADED,
  UNHEALTHY,
}
export enum Environment {
  PRODUCTION,
  DEVELOPMENT,
  OTHER,
}

export class BackendHealthDto {
  status: HealthStatus;
  service: ServiceMetadata;
  checks: ServiceHealth;
  summary: Summary;
}

class ServiceHealth {
  database: Health;
  storage: Health;
}

class ServiceMetadata {
  name: string;
  version: string;
  environment: Environment;
  uptimeSeconds: number;
  timestamp: string;
}

class Health {
  status: HealthStatus;
  latencyMs: number;
  message: string;
}

class Summary {
  healthy: number;
  degraded: number;
  unhealthy: number;
}
