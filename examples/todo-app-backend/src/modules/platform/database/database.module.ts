import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TypeOrmModule, getEntityManagerToken } from "@nestjs/typeorm"
import type { EntityManager } from "typeorm"
import { DATABASE_HEALTH } from "./database.decorators"
import { DatabaseHealth } from "./database-health.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./database.module-definition"

@Module({})
/**
 * The database capability: opens one named TypeORM connection per entry of the options and probes them for health.
 * Schema changes never happen here (`synchronize` is false, migrations run only in apps/migrate).
 */
export class DatabaseModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the connections it opens. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
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
                        migrationsRun: false,
                        retryAttempts: 2,
                    }),
                ),
            ],
            providers: [
                ...(base.providers ?? []),
                {
                    provide: DATABASE_HEALTH,
                    inject: options.connections.map((connection) => getEntityManagerToken(connection.name)),
                    useFactory: (...managers: Array<EntityManager>) => new DatabaseHealth(managers),
                },
            ],
            exports: [DATABASE_HEALTH],
        }
    }
}
