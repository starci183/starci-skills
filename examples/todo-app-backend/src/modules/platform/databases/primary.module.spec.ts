import {
    mock
} from "@starci/jest-preset/mock"
import {
    DynamicModule, FactoryProvider, Provider 
} from "@nestjs/common"
import {
    getDataSourceToken, getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    TypeOrmModuleOptions 
} from "@nestjs/typeorm"
import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    ConfigModule,
} from "@modules/platform/config/index"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    PostgresqlPrimaryModule 
} from "./primary.module"
import {
    CONNECTION, entities
} from "./persistence"

/**
 * PostgresqlPrimaryModule.register() cannot be compiled in a unit spec - TypeOrmCoreModule would open
 * a real connection - so this spec asserts on the DynamicModule shape it returns instead: the named
 * connection token, the ConfigModule injection boundary, and the options its useFactory produces.
 */
describe("PostgresqlPrimaryModule",
    () => {
        const findCoreModule = (registered: DynamicModule): DynamicModule => {
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

        it("register() returns the module itself, provides and exports PostgresPrimaryClient, and is non-global by default",
            () => {
                const registered = PostgresqlPrimaryModule.register()

                expect(registered.module).toBe(PostgresqlPrimaryModule)
                expect(registered.providers).toContain(PostgresPrimaryClient)
                expect(registered.exports).toContain(PostgresPrimaryClient)
                expect(registered.global).toBeFalsy()
                expect(PostgresqlPrimaryModule.register({
                    isGlobal: true 
                }).global).toBe(true)
            })

        it("threads the CONNECTION name into the data-source and entity-manager provider tokens",
            () => {
                const coreModule = findCoreModule(PostgresqlPrimaryModule.register())
                const tokens = (coreModule.providers ?? []).map(
                    (provider: Provider) => (typeof provider === "object" && provider !== null && "provide" in provider ? provider.provide : provider),
                )

                expect(tokens).toContain(getDataSourceToken(CONNECTION))
                expect(tokens).toContain(getEntityManagerToken(CONNECTION))
                expect(getDataSourceToken(CONNECTION)).toBe("postgresql-primaryDataSource")
            })

        it("injects AppConfigService into the options factory and imports ConfigModule for it",
            () => {
                const coreModule = findCoreModule(PostgresqlPrimaryModule.register())

                expect(coreModule.imports).toContain(ConfigModule)
                expect(findOptionsProvider(coreModule).inject).toEqual([AppConfigService])
            })

        it("builds TypeORM options from the configured database URL: no migrations run here, synchronize off, explicit entities",
            () => {
                const provider = findOptionsProvider(findCoreModule(PostgresqlPrimaryModule.register()))
                const config = mock<AppConfigService>({
                    getDatabaseUrl: () => "postgres://spec-host:5432/specdb"
                })

                const options = provider.useFactory(config) as TypeOrmModuleOptions & { url?: string }

                expect(options.type).toBe("postgres")
                expect(options.url).toBe("postgres://spec-host:5432/specdb")
                expect(options.synchronize).toBe(false)
                expect(options.migrationsRun).toBe(false)
                expect(options.migrations).toBeUndefined()
                expect(options.entities).toEqual(entities)
            })
    })
