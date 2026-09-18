import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppConfigService, ConfigModule } from '../../platform/config';
import { PostgresClient } from './postgres.client';
import { SessionEntity, TaskEntity } from './entities';
import { SESSION_STORE, TASK_STORE } from './tokens';

/**
 * integration.login.postgres / data.task.task: this is the one platform database module. It owns the
 * TypeORM connection, the entities and the migrations; domain modules never import TypeORM. They inject
 * SESSION_STORE/TASK_STORE instead, so swapping the store in a test never means swapping an ORM import.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        url: config.getDatabaseUrl(),
        entities: [SessionEntity, TaskEntity],
        migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([SessionEntity, TaskEntity]),
  ],
  providers: [
    PostgresClient,
    { provide: SESSION_STORE, useExisting: getRepositoryToken(SessionEntity) },
    { provide: TASK_STORE, useExisting: getRepositoryToken(TaskEntity) },
  ],
  exports: [PostgresClient, SESSION_STORE, TASK_STORE],
})
export class PostgresModule {}
