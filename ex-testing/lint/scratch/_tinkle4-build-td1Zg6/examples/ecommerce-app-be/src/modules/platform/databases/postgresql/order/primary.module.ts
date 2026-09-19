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
} from "@modules/platform/config/order/app-config.service"
import {
    POSTGRESQL_PRIMARY 
} from "./constants/connection"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    CartItemEntity 
} from "./entities/cart-item.entity"
import {
    OrderEntity 
} from "./entities/order.entity"
import {
    OrderLineEntity 
} from "./entities/order-line.entity"
import {
    PaymentEntity 
} from "./entities/payment.entity"
import {
    ProductEntity 
} from "./entities/product.entity"
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
                    name: POSTGRESQL_PRIMARY,
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService) => ({
                        type: "postgres" as const,
                        url: config.getDatabaseUrl(),
                        entities: [ProductEntity,
                            CartItemEntity,
                            OrderEntity,
                            OrderLineEntity,
                            PaymentEntity],
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
