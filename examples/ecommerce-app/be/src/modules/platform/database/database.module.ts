import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TypeOrmModule, getDataSourceToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { DatabaseProbe } from "./database-probe.service"
import { DATABASE_MANAGERS } from "./database-probe.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./database.module-definition"
import { IDENTITY_CONNECTION } from "./identity.connection"
import { IDENTITY_ENTITY_MANAGER } from "./identity.decorators"
import { ORDER_CONNECTION } from "./order.connection"
import { ORDER_ENTITY_MANAGER } from "./order.decorators"

/** The token each declared connection provides its shared EntityManager under. */
type EntityManagerToken = typeof IDENTITY_ENTITY_MANAGER | typeof ORDER_ENTITY_MANAGER

const ENTITY_MANAGER_TOKENS: ReadonlyMap<string, EntityManagerToken> = new Map<string, EntityManagerToken>([
    [IDENTITY_CONNECTION, IDENTITY_ENTITY_MANAGER],
    [ORDER_CONNECTION, ORDER_ENTITY_MANAGER],
])

@Module({})
/**
 * The database capability: opens one named TypeORM connection per entry of the options and probes them for health.
 * Schema changes never happen here (`synchronize` is false, migrations run only in apps/migrate).
 */
export class DatabaseModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the connections it opens. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const managers = options.connections.flatMap((connection) => {
            const token = ENTITY_MANAGER_TOKENS.get(connection.name)
            return token === undefined
                ? []
                : [
                      {
                          provide: token,
                          inject: [getDataSourceToken(connection.name)],
                          useFactory: (source: DataSource) => source.manager,
                      },
                  ]
        })
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
                {
                    provide: DATABASE_MANAGERS,
                    inject: options.connections.map((connection) => getDataSourceToken(connection.name)),
                    useFactory: (...sources: Array<DataSource>) => sources.map((source) => source.manager),
                },
                ...managers,
                DatabaseProbe,
            ],
            exports: [DatabaseProbe, ...managers.map((manager) => manager.provide)],
        }
    }
}
