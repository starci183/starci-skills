import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    TypeOrmModule 
} from "@nestjs/typeorm"
import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    ConfigModule,
} from "@modules/platform/config/index"
import {
    WinstonService,
} from "@modules/platform/logging/index"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./primary.module-definition"
import {
    CONNECTION, entities
} from "./persistence"
import {
    PostgresPrimaryClient 
} from "./primary.client"

/**
 * The one platform database module. It owns the named `CONNECTION` TypeORM connection and lists its
 * entities explicitly from `persistence/`; it never runs migrations (`migrationsRun` is `false`) - only
 * `apps/migrate` does, through `runPrimaryMigrations`. Capabilities read and write through
 * `@InjectPrimaryEntityManager()`, so none needs a per-entity `forFeature` registration.
 */
@Module({
})
/** Nest module wiring the primary capability's providers; the app composition root registers it - other modules never import it. */
export class PostgresqlPrimaryModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                TypeOrmModule.forRootAsync({
                    name: CONNECTION,
                    imports: [ConfigModule],
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService) => ({
                        type: "postgres" as const,
                        url: config.getDatabaseUrl(),
                        entities,
                        migrationsRun: false,
                        synchronize: false,
                    }),
                }),
            ],
            providers: [...(base.providers ?? []),
                WinstonService,
                PostgresPrimaryClient],
            exports: [PostgresPrimaryClient],
        }
    }
}
