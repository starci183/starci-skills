import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    TypeOrmModule 
} from "@nestjs/typeorm"
import {
    AppConfigService 
} from "ecommerce-app-be/modules/platform/config/order"
import {
    CONNECTION, entities 
} from "./persistence"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./primary.module-definition"

@Module({
})
/**
 * The one platform database module (house shape, see apps/identity's), owning the order service's
 * tables - product, cart_item, sales_order, sales_order_line, payment - in the same dev Postgres
 * database as the identity service's schema (they are disjoint; integration.checkout.postgres).
 * Whether the module is app-wide is declared at `apps/order` as `.register({ isGlobal: true })`.
 */
export class PostgresqlPrimaryModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                TypeOrmModule.forRootAsync({
                    name: CONNECTION,
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService) => ({
                        type: "postgres" as const,
                        url: config.getDatabaseUrl(),
                        entities,
                        migrationsRun: false,
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
