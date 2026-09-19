import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    TypeOrmModule 
} from "@nestjs/typeorm"
import {
    join 
} from "node:path"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    POSTGRESQL_PRIMARY 
} from "./constants/connection"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    PersonEntity 
} from "./entities/person.entity"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./primary.module-definition"

@Module({
})
/**
 * modules/platform/databases/postgresql/identity, in the house shape (todo's own comment describes
 * it): the one platform database module - it owns the named TypeORM connection, the entities and
 * the migrations; capability modules register their own EntityManager use against the entities
 * and never carry an entities/ or migrations/ folder of their own. The dev stack's Postgres runs
 * with trust authentication (see .starcistacks/dev), so the URL carries no password. Whether the
 * module is app-wide is declared at `apps/identity` as `.register({ isGlobal: true })`.
 */
export class PostgresqlPrimaryModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                TypeOrmModule.forRootAsync({
                    name: POSTGRESQL_PRIMARY,
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService) => ({
                        type: "postgres" as const,
                        url: config.getDatabaseUrl(),
                        entities: [PersonEntity],
                        migrations: [join(__dirname,
                            "migrations",
                            "*.{js,ts}")],
                        migrationsRun: true,
                        synchronize: false,
                        retryAttempts: 2,
                    }),
                }),
            ],
            providers: [...(base.providers ?? []),
                PostgresPrimaryClient],
            exports: [PostgresPrimaryClient],
        }
    }
}
