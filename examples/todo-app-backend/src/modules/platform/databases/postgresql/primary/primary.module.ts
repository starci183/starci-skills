import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppConfigService, ConfigModule } from '../../../config';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './primary.module-definition';
import { POSTGRESQL_PRIMARY } from './constants/connection';
import { PostgresPrimaryClient } from './primary.client';
import { SessionEntity, TaskEntity, ShareInvitationEntity } from './entities';

/**
 * integration.login.postgres / data.task.task: this is the one platform database module, under nivo's
 * `modules/platform/databases/postgresql/primary` shape (renamed from the former
 * `modules/integrations/postgres`). It owns the named `POSTGRESQL_PRIMARY` TypeORM connection, the
 * entities and the migrations. Capability modules import `PostgresqlPrimaryModule.register()` and
 * register their own `TypeOrmModule.forFeature([...], POSTGRESQL_PRIMARY)` against the entities this
 * module exports, so a capability module still never needs `entities/` or `migrations/` of its own.
 */
@Module({})
export class PostgresqlPrimaryModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      imports: [
        TypeOrmModule.forRootAsync({
          name: POSTGRESQL_PRIMARY,
          imports: [ConfigModule],
          inject: [AppConfigService],
          useFactory: (config: AppConfigService) => ({
            type: 'postgres' as const,
            url: config.getDatabaseUrl(),
            entities: [SessionEntity, TaskEntity, ShareInvitationEntity],
            migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
            migrationsRun: true,
            synchronize: false,
          }),
        }),
      ],
      providers: [...(base.providers ?? []), PostgresPrimaryClient],
      exports: [PostgresPrimaryClient],
    };
  }
}
