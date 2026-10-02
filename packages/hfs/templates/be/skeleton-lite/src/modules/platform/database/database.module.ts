import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TypeOrmModule, getDataSourceToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { DATABASE_OPTIONS } from "./database.port"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./database.module-definition"
import { PRIMARY_CONNECTION } from "./primary.connection"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

/** The token each declared connection provides its shared EntityManager under. */
type EntityManagerToken = typeof PRIMARY_ENTITY_MANAGER

const ENTITY_MANAGER_TOKENS: ReadonlyMap<string, EntityManagerToken> = new Map<string, EntityManagerToken>([
    [PRIMARY_CONNECTION, PRIMARY_ENTITY_MANAGER],
])

@Module({})
/** Opens each named Supabase PostgreSQL connection and exposes its shared EntityManager without entities or migrations. */
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
                        synchronize: false,
                        retryAttempts: 2,
                    }),
                ),
            ],
            providers: [...(base.providers ?? []), ...managers],
            exports: [DATABASE_OPTIONS, ...managers.map((manager) => manager.provide)],
        }
    }
}
