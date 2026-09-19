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
    DataSource 
} from "typeorm"
import {
    AppModule 
} from "./app.module"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/identity/primary.client"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/identity/constants/connection"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/redis/primary/redis.client"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"
import {
    SessionRepository 
} from "@modules/bussiness/session/session.repository"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"
import {
    OrderApiClient 
} from "@modules/integrations/order/order.client"
import {
    HealthController 
} from "@features/identity/transport/http/health.controller"
import {
    SessionController 
} from "@features/identity/transport/http/session.controller"
import {
    AccountResolver 
} from "@features/identity/graphql/queries/account/account/account.resolver"
import {
    RegisterResolver 
} from "@features/identity/graphql/mutations/session/register/register.resolver"
import {
    SignInResolver 
} from "@features/identity/graphql/mutations/session/sign-in/sign-in.resolver"

/**
 * The identity deployable's DI smoke: AppModule must compile with the platform boundary - the
 * named Postgres connection, the Redis session store, the metadata/env config - replaced by
 * doubles, and every capability service, integration client and transport door must resolve.
 * A missing export, a wrong connection name or a provider declared nowhere fails here before
 * any behavior spec runs.
 */
function postgresBoundary(): { dataSource: DataSource; manager: { findOneBy: jest.Mock; save: jest.Mock } } {
    const manager = {
        findOneBy: jest.fn(), save: jest.fn() 
    }
    const dataSource = {
        isInitialized: false,
        entityMetadatas: [],
        options: {
            type: "postgres" 
        },
        manager,
        getRepository: jest.fn(),
        query: jest.fn(),
        destroy: jest.fn(),
    } as unknown as DataSource
    return {
        dataSource, manager 
    }
}

function configBoundary(): AppConfigService {
    return {
        getProject: () => "ecommerce-app-be",
        getPort: () => 0,
        getDatabaseUrl: () => "postgres://postgres@localhost:0/ecommerce",
        getRedisUrl: () => "redis://localhost:0/0",
        getOrderApiBaseUrl: () => "http://localhost:0",
        getSessionTtlSeconds: () => 3600,
    } as unknown as AppConfigService
}

function redisBoundary(): RedisPrimaryClient {
    return {
        ping: jest.fn(),
        store: jest.fn(),
        lookup: jest.fn(),
        forget: jest.fn(),
        close: jest.fn(),
    } as unknown as RedisPrimaryClient
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
                .overrideProvider(getDataSourceToken(POSTGRESQL_PRIMARY))
                .useValue(postgres.dataSource)
            // forRootAsync's options carry no `name`, so shutdown would look up the default DataSource
            // token and throw; naming the options double keeps module.close() honest.
                .overrideProvider("TypeOrmModuleOptions")
                .useValue({
                    name: POSTGRESQL_PRIMARY, type: "postgres" 
                })
                .overrideProvider(RedisPrimaryClient)
                .useValue(redis)
                .overrideProvider(AppConfigService)
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
                    PostgresPrimaryClient,
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
                expect(module.get(getDataSourceToken(POSTGRESQL_PRIMARY))).toBe(postgres.dataSource)
                expect(module.get(getEntityManagerToken(POSTGRESQL_PRIMARY))).toBe(postgres.manager)
            })

        it("resolves the global platform providers as the boundary doubles",
            () => {
                expect(module.get(AppConfigService)).toBe(config)
                expect(module.get(RedisPrimaryClient)).toBe(redis)
            })

        it("registers no global guard or interceptor - every identity door is intentionally open",
            () => {
                expect(() => module.get(APP_GUARD)).toThrow()
                expect(() => module.get(APP_INTERCEPTOR)).toThrow()
            })
    })
