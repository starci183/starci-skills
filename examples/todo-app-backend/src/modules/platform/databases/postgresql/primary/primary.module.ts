import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppConfigService, ConfigModule } from '../../platform/config';
import { PostgresClient } from './postgres.client';
import { SessionEntity, TaskEntity } from './entities';

/**
 * integration.login.postgres / data.task.task: this is the one platform database module. It owns the
 * TypeORM connection, the entities and the migrations. Domain modules import PostgresModule and register
 * their own TypeOrmModule.forFeature([...]) against the entities this module exports, so a domain module
 * still never needs entities/ or migrations/ of its own.
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
  ],
  providers: [PostgresClient],
  exports: [PostgresClient],
})
export class PostgresModule {}
