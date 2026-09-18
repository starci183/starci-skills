import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../../config';
import { PostgresPrimaryUnavailableException } from '@modules/shared/exceptions';

/**
 * integration.login.postgres is still todo: no migration has been applied against a real server yet, so
 * this client exists as the declared external-protocol owner without capability services depending on
 * it. Renamed from the former `PostgresClient` (under `modules/integrations/postgres`) to
 * `PostgresPrimaryClient` under `modules/platform/databases/postgresql/primary` to match nivo's
 * centralised-database shape: one owned connection per named database, not a per-provider integration.
 */
@Injectable()
export class PostgresPrimaryClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: AppConfigService) {
    this.pool = new Pool({ connectionString: this.config.getDatabaseUrl() });
  }

  async ping(): Promise<void> {
    let rowCount: number | null;
    try {
      rowCount = (await this.pool.query('SELECT 1')).rowCount;
    } catch (error) {
      throw new PostgresPrimaryUnavailableException({ reason: String(error) });
    }
    if (rowCount !== 1) {
      throw new PostgresPrimaryUnavailableException({ reason: 'unexpected row count' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
