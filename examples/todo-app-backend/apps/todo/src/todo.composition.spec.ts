import "reflect-metadata"
import { APP_GUARD } from "@nestjs/core"
import { CommandBus } from "@nestjs/cqrs"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { getDataSourceToken, getEntityManagerToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { mock } from "@starci/jest-preset/mock"
import { SubscriptionService } from "@modules/domain/plan"
import { AuthGuard, SessionService } from "@modules/domain/session"
import { TaskService } from "@modules/domain/task"
import { ConfigError, EnvSource, Secret } from "@modules/platform/config"
import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { ERRORS_SERVICE } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { LOGGER } from "@modules/platform/logging"
import { mockEntityManager } from "@tests/fixtures/database"
import { AppModule } from "./app.module"
import { parseTodoAppOptions } from "./todo.options"
import type { TodoAppOptions } from "./todo.options"

const options: TodoAppOptions = {
    port: 0,
    database: { name: PRIMARY_CONNECTION, url: new Secret("postgres://localhost:0/todo") },
    httpSecurity: { allowedOrigins: ["http://localhost:3000"], rateLimit: { windowMs: 1000, defaultLimit: 10, strictLimit: 5 } },
    session: { ttlDays: 1, adminSubjects: [] },
    keycloak: { tokenUrl: "http://localhost:0/token", clientId: "todo-api", timeoutMs: 100 },
    sepay: { baseUrl: "http://localhost:0", apiKey: new Secret("k"), webhookSecret: new Secret("w"), timeoutMs: 100 },
    plan: { paidPriceMinorUnits: 99000, paidCurrency: "VND" },
    recur: { tickCron: "*/5 * * * *" },
    upload: { maxBytes: 1024, allowedMimes: ["text/plain"], presignTtlMs: 1000, signingSecret: new Secret("s") },
    uploadStorage: { directory: "/tmp/todo-uploads" },
    notifySmtp: { host: "localhost", port: 0, from: "todo@example.test", connectTimeoutMs: 100, commandTimeoutMs: 100 },
}

const environment: Record<string, string> = {
    PORT: "3001",
    PRIMARY_DB_URL: "postgres://localhost:5501/todo",
    HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000",
    KEYCLOAK_TOKEN_URL: "http://localhost:8089/token",
    KEYCLOAK_CLIENT_ID: "todo-api",
    SEPAY_BASE_URL: "http://localhost:0",
    SEPAY_API_KEY: "k",
    SEPAY_WEBHOOK_SECRET: "w",
    UPLOAD_DIR: "/tmp/todo-uploads",
    UPLOAD_SIGNING_SECRET: "s",
    SMTP_HOST: "localhost",
    SMTP_PORT: "1025",
    SMTP_FROM: "todo@example.test",
}

describe("todo AppModule", () => {
    let module: TestingModule
    const manager = mockEntityManager()

    beforeAll(async () => {
        const dataSource = mock<DataSource>({ isInitialized: false, manager, entityMetadatas: [], options: { type: "postgres" } })
        module = await Test.createTestingModule({ imports: [AppModule.register(options)] })
            .overrideProvider(getDataSourceToken(PRIMARY_CONNECTION))
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
        for (const token of [SessionService, TaskService, SubscriptionService]) {
            expect(module.get(token)).toBeInstanceOf(token)
        }
        expect(module.get(CommandBus)).toBeInstanceOf(CommandBus)
        expect(module.get(ERRORS_SERVICE)).toBeDefined()
        expect(module.get(LOGGER)).toBeDefined()
    })

    it("binds the one primary EntityManager to the connection double", () => {
        expect(module.get(getEntityManagerToken(PRIMARY_CONNECTION))).toBe(manager)
    })

    it("registers the app guards in order: rate limit, origin, auth", () => {
        const guards = (AppModule.register(options).providers ?? []).flatMap((provider) =>
            "provide" in provider && provider.provide === APP_GUARD && "useClass" in provider ? [provider.useClass] : [],
        )
        expect(guards).toEqual([RateLimitGuard, OriginGuard, AuthGuard])
    })
})

describe("parseTodoAppOptions", () => {
    it("reads the port, the primary database and every capability from the environment", () => {
        const parsed = parseTodoAppOptions(new EnvSource(environment))
        expect(parsed.port).toBe(3001)
        expect(parsed.database.name).toBe(PRIMARY_CONNECTION)
        expect(parsed.database.url.reveal()).toBe("postgres://localhost:5501/todo")
        expect(parsed.httpSecurity.allowedOrigins).toEqual(["http://localhost:3000"])
        expect(parsed.keycloak.clientId).toBe("todo-api")
    })

    it("stops the boot when a required key is missing", () => {
        expect(() => parseTodoAppOptions(new EnvSource({}))).toThrow(ConfigError)
    })
})
