import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../platform/config';
import { PostgresUnavailableException } from './postgres.exception';

/**
 * integration.login.postgres is still todo: no migration has been applied against a real server yet, so
 * this client exists as the declared external-protocol owner without domain repositories depending on it.
 * Domain state currently lives in the in-memory repositories under modules/domain until that migration lands.
 */
@Injectable()
export class PostgresClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: AppConfigService) {
    this.pool = new Pool({ connectionString: this.config.getDatabaseUrl() });
  }

  async ping(): Promise<void> {
    let rowCount: number | null;
    try {
      rowCount = (await this.pool.query('SELECT 1')).rowCount;
    } catch (error) {
      throw new PostgresUnavailableException(String(error));
    }
    if (rowCount !== 1) {
      throw new PostgresUnavailableException('unexpected row count');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
