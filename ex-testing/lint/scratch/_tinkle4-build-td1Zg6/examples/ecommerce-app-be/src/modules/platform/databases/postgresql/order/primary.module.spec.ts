import "reflect-metadata"
import {
    DynamicModule, FactoryProvider, Provider 
} from "@nestjs/common"
import {
    getDataSourceToken, getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    AppConfigService 
} from "@modules/platform/config/order/app-config.service"
import {
    POSTGRESQL_PRIMARY 
} from "./constants/connection"
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
    PostgresPrimaryClient 
} from "./primary.client"
import {
    PostgresqlPrimaryModule 
} from "./primary.module"

/**
 * Compiling PostgresqlPrimaryModule in a unit spec would open a real Postgres connection, so this
 * spec asserts on the shape its register() declares instead: the named TypeOrmCoreModule sitting
 * in its imports, the AppConfigService injection boundary, and the options its useFactory
 * produces.
 */
describe("PostgresqlPrimaryModule (order)",
    () => {
        const registered = PostgresqlPrimaryModule.register()

        const findCoreModule = (): DynamicModule => {
            const typeOrmModule = (registered.imports ?? []).find(
                (entry): entry is DynamicModule =>
                    typeof entry === "object" && entry !== null && (entry as DynamicModule).module?.name === "TypeOrmModule",
            )
            if (!typeOrmModule) throw new Error("TypeOrmModule dynamic module not found in imports")
            const coreModule = (typeOrmModule.imports ?? []).find(
                (entry): entry is DynamicModule =>
                    typeof entry === "object" && entry !== null && (entry as DynamicModule).module?.name === "TypeOrmCoreModule",
            )
            if (!coreModule) throw new Error("TypeOrmCoreModule dynamic module not found in imports")
            return coreModule
        }

        const findOptionsProvider = (coreModule: DynamicModule): FactoryProvider => {
            const provider = (coreModule.providers ?? []).find(
                (candidate): candidate is FactoryProvider =>
                    typeof candidate === "object" &&
        candidate !== null &&
        "useFactory" in candidate &&
        ((candidate as FactoryProvider).inject ?? []).includes(AppConfigService),
            )
            if (!provider) throw new Error("TypeOrmModule options factory provider not found")
            return provider
        }

        it("provides and exports PostgresPrimaryClient",
            () => {
                expect(registered.providers ?? []).toContain(PostgresPrimaryClient)
                expect(registered.exports ?? []).toContain(PostgresPrimaryClient)
            })

        it("threads the POSTGRESQL_PRIMARY name into the data-source and entity-manager tokens",
            () => {
                const tokens = (findCoreModule().providers ?? []).map((provider: Provider) =>
                    typeof provider === "object" && provider !== null && "provide" in provider ? provider.provide : provider,
                )

                expect(tokens).toContain(getDataSourceToken(POSTGRESQL_PRIMARY))
                expect(tokens).toContain(getEntityManagerToken(POSTGRESQL_PRIMARY))
                expect(getDataSourceToken(POSTGRESQL_PRIMARY)).toBe("ECOMMERCE_ORDER_POSTGRESQL_PRIMARYDataSource")
            })

        it("injects AppConfigService into the options factory",
            () => {
                expect(findOptionsProvider(findCoreModule()).inject).toEqual([AppConfigService])
            })

        it("builds TypeORM options from the configured URL with the order schema, migrations on, synchronize off",
            () => {
                const provider = findOptionsProvider(findCoreModule())
                const config = {
                    getDatabaseUrl: () => "postgres://spec-host:5432/specdb" 
                } as AppConfigService

                const options = provider.useFactory(config) as Record<string, unknown>

                expect(options.type).toBe("postgres")
                expect(options.url).toBe("postgres://spec-host:5432/specdb")
                expect(options.entities).toEqual([
                    ProductEntity,
                    CartItemEntity,
                    OrderEntity,
                    OrderLineEntity,
                    PaymentEntity,
                ])
                expect(String((options.migrations as Array<unknown>)?.[0])).toMatch(/migrations[/\\]\*\.\{js,ts\}$/)
                expect(options.migrationsRun).toBe(true)
                expect(options.synchronize).toBe(false)
                expect(options.retryAttempts).toBe(2)
            })
    })
