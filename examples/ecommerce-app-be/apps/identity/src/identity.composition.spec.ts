import "reflect-metadata"
import { APP_GUARD } from "@nestjs/core"
import { CommandBus } from "@nestjs/cqrs"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { getDataSourceToken, getEntityManagerToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { mock } from "@starci/jest-preset/mock"
import { AccountService } from "@modules/domain/account"
import { AuthGuard } from "@modules/domain/auth"
import { SessionService } from "@modules/domain/session"
import { CACHE } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import { ConfigError, EnvSource, Secret } from "@modules/platform/config"
import { ERRORS_SERVICE } from "@modules/platform/errors"
import { IDENTITY_CONNECTION } from "@modules/platform/database"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { LOGGER } from "@modules/platform/logging"
import { mockEntityManager } from "@tests/fixtures/database"
import { AppModule } from "./app.module"
import { parseIdentityAppOptions } from "./identity.options"
import type { IdentityAppOptions } from "./identity.options"

const options: IdentityAppOptions = {
    port: 0,
    database: { name: IDENTITY_CONNECTION, url: new Secret("postgres://localhost:0/identity") },
    cache: { url: new Secret("redis://localhost:0/0") },
    orderApi: { url: "http://localhost:0", timeoutMs: 100 },
    httpSecurity: { allowedOrigins: ["http://localhost:3000"], rateLimit: { windowMs: 1000, defaultLimit: 10, strictLimit: 5 } },
}

const environment: Record<string, string> = {
    IDENTITY_API_PORT: "5070",
    IDENTITY_DB_URL: "postgres://localhost:5501/identity",
    CACHE_REDIS_URL: "redis://localhost:6448/0",
    ORDER_API_URL: "http://localhost:6070",
    HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000, http://localhost:4000",
}

describe("identity AppModule", () => {
    let module: TestingModule
    const manager = mockEntityManager()

    beforeAll(async () => {
        const dataSource = mock<DataSource>({ isInitialized: false, manager, entityMetadatas: [], options: { type: "postgres" } })
        module = await Test.createTestingModule({ imports: [AppModule.register(options)] })
            .overrideProvider(getDataSourceToken(IDENTITY_CONNECTION))
            .useValue(dataSource)
            .overrideProvider(CACHE)
            .useValue(mock<Cache>())
            .compile()
    })

    afterAll(async () => {
        await module.close()
    })

    it("compiles the real root module with the database and the cache doubled", () => {
        expect(module).toBeDefined()
    })

    it("resolves the capabilities and the platform ports the doors depend on", () => {
        expect(module.get(AccountService)).toBeInstanceOf(AccountService)
        expect(module.get(SessionService)).toBeInstanceOf(SessionService)
        expect(module.get(CommandBus)).toBeInstanceOf(CommandBus)
        expect(module.get(ERRORS_SERVICE)).toBeDefined()
        expect(module.get(LOGGER)).toBeDefined()
    })

    it("binds the one identity EntityManager to the connection double", () => {
        expect(module.get(getEntityManagerToken(IDENTITY_CONNECTION))).toBe(manager)
    })

    it("registers the app guards in order: rate limit, origin, auth", () => {
        const guards = (AppModule.register(options).providers ?? []).flatMap((provider) =>
            "provide" in provider && provider.provide === APP_GUARD && "useClass" in provider ? [provider.useClass] : [],
        )
        expect(guards).toEqual([RateLimitGuard, OriginGuard, AuthGuard])
    })
})

describe("parseIdentityAppOptions", () => {
    it("reads the port, the identity database, the cache, the order api and the http security from the environment", () => {
        const parsed = parseIdentityAppOptions(new EnvSource(environment))
        expect(parsed.port).toBe(5070)
        expect(parsed.database.name).toBe(IDENTITY_CONNECTION)
        expect(parsed.database.url.reveal()).toBe("postgres://localhost:5501/identity")
        expect(parsed.cache.url.reveal()).toBe("redis://localhost:6448/0")
        expect(parsed.orderApi).toEqual({ url: "http://localhost:6070", timeoutMs: 3000 })
        expect(parsed.httpSecurity.allowedOrigins).toEqual(["http://localhost:3000", "http://localhost:4000"])
    })

    it("stops the boot when a required key is missing", () => {
        expect(() => parseIdentityAppOptions(new EnvSource({}))).toThrow(ConfigError)
    })
})
