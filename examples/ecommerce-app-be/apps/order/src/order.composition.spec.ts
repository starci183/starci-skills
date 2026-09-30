import "reflect-metadata"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { CommandBus } from "@nestjs/cqrs"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { getDataSourceToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { mock } from "@starci/jest-preset/mock"
import { AuthGuard } from "@modules/domain/identity"
import { CartService } from "@modules/domain/cart"
import { CatalogService } from "@modules/domain/catalog"
import { OrderService } from "@modules/domain/order"
import { PaymentService } from "@modules/domain/payment"
import { EnvSource, Secret } from "@modules/platform/config"
import { DatabaseProbeService, ORDER_CONNECTION } from "@modules/platform/database"
import { ERRORS_SERVICE, ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { mockEntityManager } from "@tests/fixtures/database"
import { AppModule } from "./app.module"
import { parseOrderAppOptions } from "./order.options"
import type { OrderAppOptions } from "./order.options"

const options: OrderAppOptions = {
    port: 0,
    database: { name: ORDER_CONNECTION, url: new Secret("postgres://localhost:0/order") },
    identityApi: { url: "http://localhost:0", timeoutMs: 100 },
    httpSecurity: {
        allowedOrigins: ["http://localhost:3000"],
        rateLimit: { windowMs: 1000, defaultLimit: 10, strictLimit: 5 },
    },
}

const environment: Record<string, string> = {
    ORDER_API_PORT: "6070",
    ORDER_DB_URL: "postgres://localhost:5501/order",
    IDENTITY_API_URL: "http://localhost:5070",
    IDENTITY_API_TIMEOUT: "5s",
    HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000",
}

describe("order AppModule", () => {
    let module: TestingModule
    const manager = mockEntityManager()

    beforeAll(async () => {
        const dataSource = mock<DataSource>({
            isInitialized: false,
            manager,
            entityMetadatas: [],
            options: { type: "postgres", synchronize: false },
        })
        module = await Test.createTestingModule({ imports: [AppModule.register(options)] })
            .overrideProvider(getDataSourceToken(ORDER_CONNECTION))
            .useValue(dataSource)
            .compile()
    })

    afterAll(async () => {
        await module.close()
    })

    it("compiles the real root module with the database doubled", () => {
        expect(module).toBeDefined()
    })

    it("resolves the capabilities and the platform ports the doors depend on", () => {
        for (const token of [CatalogService, CartService, PaymentService, OrderService]) {
            expect(module.get(token)).toBeInstanceOf(token)
        }
        expect(module.get(CommandBus)).toBeInstanceOf(CommandBus)
        expect(module.get(ERRORS_SERVICE)).toBeDefined()
    })

    it("provides the database probe over the connection double", () => {
        expect(module.get(DatabaseProbeService)).toBeInstanceOf(DatabaseProbeService)
    })

    it("binds the one errors filter of platform/errors app-wide", () => {
        const filters = (AppModule.register(options).providers ?? []).flatMap((provider) =>
            "provide" in provider && provider.provide === APP_FILTER && "useClass" in provider
                ? [provider.useClass]
                : [],
        )
        expect(filters).toEqual([ErrorsFilter])
    })

    it("registers the app guards in order: rate limit, origin, auth", () => {
        const guards = (AppModule.register(options).providers ?? []).flatMap((provider) =>
            "provide" in provider && provider.provide === APP_GUARD && "useClass" in provider
                ? [provider.useClass]
                : [],
        )
        expect(guards).toEqual([RateLimitGuard, OriginGuard, AuthGuard])
    })
})

describe("parseOrderAppOptions", () => {
    it("reads the port, the order database, the identity api and the http security from the environment", () => {
        const parsed = parseOrderAppOptions(new EnvSource(environment))
        expect(parsed.port).toBe(6070)
        expect(parsed.database.name).toBe(ORDER_CONNECTION)
        expect(parsed.database.url.reveal()).toBe("postgres://localhost:5501/order")
        expect(parsed.identityApi).toEqual({ url: "http://localhost:5070", timeoutMs: 5000 })
        expect(parsed.httpSecurity.allowedOrigins).toEqual(["http://localhost:3000"])
    })

    it("stops the boot when a required key is missing", () => {
        expect(() => parseOrderAppOptions(new EnvSource({}))).toThrow("CONFIG_KEY_MISSING")
    })
})
