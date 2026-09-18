import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppConfigService } from '../../../config';
import { POSTGRESQL_PRIMARY } from './constants/connection';
import { PostgresPrimaryClient } from './primary.client';
import { PersonEntity } from './entities';

/**
 * modules/platform/databases/postgresql/primary, in the house shape (todo's own comment describes
 * it): the one platform database module - it owns the named TypeORM connection, the entities and
 * the migrations; capability modules register their own TypeOrmModule.forFeature(...) against the
 * entities and never carry an entities/ or migrations/ folder of their own. The dev stack's
 * Postgres runs with trust authentication (see .starcistacks/dev), so the URL carries no password.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: POSTGRESQL_PRIMARY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        url: config.getDatabaseUrl(),
        entities: [PersonEntity],
        migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 2,
      }),
    }),
  ],
  providers: [PostgresPrimaryClient],
  exports: [PostgresPrimaryClient],
})
export class PostgresqlPrimaryModule {}
