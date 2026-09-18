import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PostgresPrimaryClient } from '../../../../modules/platform/databases/postgresql/primary';
import { IdentityApiClient } from '../../../../modules/integrations/identity';

interface HealthResult {
  status: 'ok';
  service: 'order';
  checks: { postgres: 'ok'; identity: 'ok' };
}

/** GET /health - answers only when Postgres answers and the identity service's own /health does;
 * the dependency check is a real HTTP call, so this door proves the pair is wired while it is up. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly postgres: PostgresPrimaryClient,
    private readonly identityApi: IdentityApiClient,
  ) {}

  @Get()
  async check(): Promise<HealthResult> {
    const checks: Record<'postgres' | 'identity', 'ok' | 'unreachable'> = { postgres: 'ok', identity: 'ok' };
    try {
      await this.postgres.ping();
    } catch {
      checks.postgres = 'unreachable';
    }
    if (!(await this.identityApi.isHealthy())) {
      checks.identity = 'unreachable';
    }
    if (checks.postgres !== 'ok' || checks.identity !== 'ok') {
      throw new HttpException(
        { code: 'DEPENDENCY_UNAVAILABLE', message: `Dependency refused: ${JSON.stringify(checks)}` },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok', service: 'order', checks: { postgres: 'ok', identity: 'ok' } };
  }
}
