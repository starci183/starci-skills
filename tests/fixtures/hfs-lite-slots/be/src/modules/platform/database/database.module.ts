import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TypeOrmModule, getDataSourceToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./database.module-definition"
import { DATABASE_OPTIONS } from "./database.port"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

/** Opens declared Supabase connections with schema changes owned by Supabase migrations. */
@Module({})
export class DatabaseModule extends ConfigurableModuleClass {
    /** Exposes the primary connection's real shared EntityManager to capability modules. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ...options.connections.map((connection) => TypeOrmModule.forRoot({
                name: connection.name,
                type: "postgres",
                url: connection.url.reveal(),
                schema: connection.schema,
                synchronize: false,
                retryAttempts: 2,
            }))],
            providers: [...(base.providers ?? []), {
                provide: PRIMARY_ENTITY_MANAGER,
                inject: [getDataSourceToken("primary")],
                useFactory: (source: DataSource) => source.manager,
            }],
            exports: [...(base.exports ?? []), DATABASE_OPTIONS, PRIMARY_ENTITY_MANAGER],
        }
    }
}
