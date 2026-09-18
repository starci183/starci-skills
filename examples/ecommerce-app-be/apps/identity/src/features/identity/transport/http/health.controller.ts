import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PostgresPrimaryClient } from '../../../../modules/platform/databases/postgresql/primary';
import { RedisPrimaryClient } from '../../../../modules/platform/caches/redis/primary';

interface HealthResult {
  status: 'ok';
  service: 'identity';
  checks: { postgres: 'ok'; redis: 'ok' };
}

/** The plain HTTP /health the infrastructure probe speaks (todo keeps exactly one door too):
 * it answers only when both dependencies answer, and says which one refused when it does not. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly postgres: PostgresPrimaryClient,
    private readonly redis: RedisPrimaryClient,
  ) {}

  @Get()
  async check(): Promise<HealthResult> {
    const checks: Record<'postgres' | 'redis', 'ok' | 'unreachable'> = { postgres: 'ok', redis: 'ok' };
    try {
      await this.postgres.ping();
    } catch {
      checks.postgres = 'unreachable';
    }
    try {
      await this.redis.ping();
    } catch {
      checks.redis = 'unreachable';
    }
    if (checks.postgres !== 'ok' || checks.redis !== 'ok') {
      throw new HttpException(
        { code: 'DEPENDENCY_UNAVAILABLE', message: `Dependency refused: ${JSON.stringify(checks)}` },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok', service: 'identity', checks: { postgres: 'ok', redis: 'ok' } };
  }
}
