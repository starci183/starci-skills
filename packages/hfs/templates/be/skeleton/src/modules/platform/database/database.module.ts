import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { TypeOrmModule, getDataSourceToken } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { openConnectionSource } from "./connection-source.client";
import {
  CONNECTION_SOURCE,
  DATABASE_OPTIONS,
  READ_SEED_FILES,
} from "./database.port";
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./database.module-definition";
import { MigrationRunnerService } from "./migration-runner.service";
import { readSeedFiles } from "./seed-connections.client";
import { SeedRunnerService } from "./seed-runner.service";
import { PRIMARY_CONNECTION } from "./primary.connection";
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators";

/** The token each declared connection provides its shared EntityManager under. */
type EntityManagerToken = typeof PRIMARY_ENTITY_MANAGER;

const ENTITY_MANAGER_TOKENS: ReadonlyMap<string, EntityManagerToken> = new Map<
  string,
  EntityManagerToken
>([[PRIMARY_CONNECTION, PRIMARY_ENTITY_MANAGER]]);

@Module({})
/**
 * The database capability: opens one named TypeORM connection per entry of the options and provides its shared
 * EntityManager, the options and the opener of a one-off data source (the cli migrate and seed commands). The schema never changes here: only migrations change it, and they run only in the cli migrate command.
 */
export class DatabaseModule extends ConfigurableModuleClass {
  /** Registers the capability once per app with the connections it opens. */
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const base = super.register(options);
    const managers = options.connections.flatMap((connection) => {
      const token = ENTITY_MANAGER_TOKENS.get(connection.name);
      return token === undefined
        ? []
        : [
            {
              provide: token,
              inject: [getDataSourceToken(connection.name)],
              useFactory: (source: DataSource) => source.manager,
            },
          ];
    });
    return {
      ...base,
      imports: [
        ...(base.imports ?? []),
        ...options.connections.map((connection) =>
          TypeOrmModule.forRoot({
            name: connection.name,
            type: "postgres",
            url: connection.url.reveal(),
            entities: [...connection.entities],
            synchronize: false,
            retryAttempts: 2,
          }),
        ),
      ],
      providers: [
        ...(base.providers ?? []),
        ...managers,
        MigrationRunnerService,
        SeedRunnerService,
        {
          provide: CONNECTION_SOURCE,
          useValue: { open: openConnectionSource },
        },
        { provide: READ_SEED_FILES, useValue: { read: readSeedFiles } },
      ],
      exports: [
        DATABASE_OPTIONS,
        CONNECTION_SOURCE,
        MigrationRunnerService,
        SeedRunnerService,
        ...managers.map((manager) => manager.provide),
      ],
    };
  }
}
