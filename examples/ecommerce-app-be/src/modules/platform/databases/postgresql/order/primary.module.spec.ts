import "reflect-metadata"
import {
    DynamicModule, FactoryProvider, Provider 
} from "@nestjs/common"
import {
    getDataSourceToken, getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    OrderConfigService 
} from "@modules/platform/config/index"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    CONNECTION, entities 
} from "./persistence"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    PostgresqlPrimaryModule 
} from "./primary.module"

/**
 * Compiling PostgresqlPrimaryModule in a unit spec would open a real Postgres connection, so this
 * spec asserts on the shape its register() declares instead: the named TypeOrmCoreModule sitting
 * in its imports, the OrderConfigService injection boundary, and the options its useFactory
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
        ((candidate as FactoryProvider).inject ?? []).includes(OrderConfigService),
            )
            if (!provider) throw new Error("TypeOrmModule options factory provider not found")
            return provider
        }

        it("provides and exports PostgresPrimaryClient",
            () => {
                expect(registered.providers ?? []).toContain(PostgresPrimaryClient)
                expect(registered.exports ?? []).toContain(PostgresPrimaryClient)
            })

        it("threads the CONNECTION name into the data-source and entity-manager tokens",
            () => {
                const tokens = (findCoreModule().providers ?? []).map((provider: Provider) =>
                    typeof provider === "object" && provider !== null && "provide" in provider ? provider.provide : provider,
                )

                expect(tokens).toContain(getDataSourceToken(CONNECTION))
                expect(tokens).toContain(getEntityManagerToken(CONNECTION))
                expect(getDataSourceToken(CONNECTION)).toBe("ECOMMERCE_ORDER_CONNECTIONDataSource")
            })

        it("injects OrderConfigService into the options factory",
            () => {
                expect(findOptionsProvider(findCoreModule()).inject).toEqual([OrderConfigService])
            })

        it("builds TypeORM options from the configured URL with the order schema, migrations never run at boot, synchronize off",
            () => {
                const provider = findOptionsProvider(findCoreModule())
                const config = mock<OrderConfigService>({
                    getDatabaseUrl: () => "postgres://spec-host:5432/specdb" 
                })

                const options = provider.useFactory(config) as Record<string, unknown>

                expect(options.type).toBe("postgres")
                expect(options.url).toBe("postgres://spec-host:5432/specdb")
                expect(options.entities).toBe(entities)
                expect(options.migrations).toBeUndefined()
                expect(options.migrationsRun).toBe(false)
                expect(options.synchronize).toBe(false)
                expect(options.retryAttempts).toBe(2)
            })
    })
