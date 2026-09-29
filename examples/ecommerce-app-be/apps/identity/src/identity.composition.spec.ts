import "reflect-metadata"
import {
    APP_GUARD, APP_INTERCEPTOR 
} from "@nestjs/core"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getDataSourceToken, getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    DataSource, EntityManager 
} from "typeorm"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    AppModule 
} from "./app.module"
import {
    Logger 
} from "@modules/platform/logging"
import {
    Clock, SystemClock 
} from "@modules/platform/clock/index"
import {
    IdentityConfigService 
} from "@modules/platform/config/index"
import {
    IdentityPostgresPrimaryClient, IDENTITY_POSTGRESQL 
} from "@modules/platform/databases/index"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/index"
import {
    AccountService 
} from "@modules/domain/account/index"
import {
    SessionRepository, SessionService 
} from "@modules/domain/session/index"
import {
    OrderApiClient 
} from "@modules/integrations/order/index"
import {
    HealthController, SessionController, AccountResolver, RegisterResolver, SignInResolver 
} from "@features/identity/index"

/**
 * The identity deployable's DI smoke: AppModule must compile with the platform boundary - the
 * named Postgres connection, the Redis session store, the metadata/env config - replaced by
 * doubles, and every capability service, integration client and transport door must resolve.
 * A missing export, a wrong connection name or a provider declared nowhere fails here before
 * any behavior spec runs.
 */
function postgresBoundary(): { dataSource: DataSource; manager: EntityManager } {
    const manager = mock<EntityManager>({
        findOneBy: jest.fn(), save: jest.fn() 
    })
    const dataSource = mock<DataSource>({
        isInitialized: false,
        entityMetadatas: [],
        options: {
            type: "postgres" 
        },
        manager,
        getRepository: jest.fn(),
        query: jest.fn(),
        destroy: jest.fn(),
    })
    return {
        dataSource, manager 
    }
}

function configBoundary(): IdentityConfigService {
    return mock<IdentityConfigService>({
        getProject: () => "ecommerce-app-be",
        getPort: () => 0,
        getDatabaseUrl: () => "postgres://postgres@localhost:0/ecommerce",
        getRedisUrl: () => "redis://localhost:0/0",
        getOrderApiBaseUrl: () => "http://localhost:0",
        getSessionTtlSeconds: () => 3600,
    })
}

function redisBoundary(): RedisPrimaryClient {
    return mock<RedisPrimaryClient>()
}

describe("identity AppModule - module boot",
    () => {
        let module: TestingModule
        let postgres: ReturnType<typeof postgresBoundary>
        const config = configBoundary()
        const redis = redisBoundary()

        beforeAll(async () => {
            postgres = postgresBoundary()
            module = await Test.createTestingModule({
                imports: [AppModule] 
            })
                .overrideProvider(getDataSourceToken(IDENTITY_POSTGRESQL))
                .useValue(postgres.dataSource)
            // forRootAsync's options carry no `name`, so shutdown would look up the default DataSource
            // token and throw; naming the options double keeps module.close() honest.
                .overrideProvider("TypeOrmModuleOptions")
                .useValue({
                    name: IDENTITY_POSTGRESQL, type: "postgres" 
                })
                .overrideProvider(RedisPrimaryClient)
                .useValue(redis)
                .overrideProvider(IdentityConfigService)
                .useValue(config)
                .compile()
        })

        afterAll(async () => {
            await module.close()
        })

        it("compiles the root module with the platform boundary doubled",
            () => {
                expect(module).toBeDefined()
            })

        it("resolves the capability services, the platform client and the order integration client",
            () => {
                for (const token of [AccountService,
                    SessionService,
                    SessionRepository,
                    IdentityPostgresPrimaryClient,
                    OrderApiClient]) {
                    expect(module.get(token)).toBeDefined()
                }
            })

        it("resolves every justified REST controller and every GraphQL resolver",
            () => {
                for (const token of [SessionController,
                    HealthController,
                    RegisterResolver,
                    SignInResolver,
                    AccountResolver]) {
                    expect(module.get(token)).toBeDefined()
                }
            })

        it("binds the named TypeORM connection and its EntityManager to the doubled DataSource",
            () => {
                expect(module.get(getDataSourceToken(IDENTITY_POSTGRESQL))).toBe(postgres.dataSource)
                expect(module.get(getEntityManagerToken(IDENTITY_POSTGRESQL))).toBe(postgres.manager)
            })

        it("resolves the global platform providers as the boundary doubles",
            () => {
                expect(module.get(IdentityConfigService)).toBe(config)
                expect(module.get(RedisPrimaryClient)).toBe(redis)
                expect(module.get(Logger)).toBeInstanceOf(Logger)
                expect(module.get(Clock)).toBeInstanceOf(SystemClock)
            })

        it("registers no global guard or interceptor - every identity door is intentionally open",
            () => {
                expect(() => module.get(APP_GUARD)).toThrow()
                expect(() => module.get(APP_INTERCEPTOR)).toThrow()
            })
    })
