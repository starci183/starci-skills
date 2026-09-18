import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PostgresPrimaryClient } from '@modules/platform/databases/postgresql/primary';

/**
 * The one surviving HTTP transport, mirroring nivo's own placement (`health.module.ts` mounted beside
 * its own feature, not from `modules/platform/health`): every other route moved to GraphQL, but nivo
 * itself keeps a plain HTTP `/health` for infrastructure probes that should not have to speak GraphQL.
 * Simplified from nivo's split live/ready `@nestjs/terminus` pair to one check, since this example has
 * exactly one dependency (Postgres) worth probing and adding Terminus for a single indicator would be
 * a dependency this host cannot justify pulling in for one ping.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly db: PostgresPrimaryClient) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.db.ping();
    } catch {
      throw new HttpException('The database could not be reached.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok' };
  }
}
