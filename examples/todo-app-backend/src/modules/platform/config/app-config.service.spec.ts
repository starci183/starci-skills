import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    readFileSync 
} from "node:fs"
import {
    AppConfigService 
} from "./app-config.service"
import {
    ConfigModule 
} from "./config.module"

jest.mock("node:fs",
    () => {
        const actual = jest.requireActual<typeof import("node:fs")>("node:fs")
        return {
            ...actual, readFileSync: jest.fn() 
        }
    })

const ENV_KEYS = [
    "TODO_SESSION_TTL_DAYS",
    "KEYCLOAK_TOKEN_URL",
    "KEYCLOAK_CLIENT_ID",
    "DATABASE_URL",
    "CORS_ORIGIN",
    "PORT",
    "RECUR_TICK_CRON",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_FROM",
    "REDIS_URL",
    "SEPAY_BASE_URL",
    "SEPAY_API_KEY_FILE",
    "SEPAY_WEBHOOK_SECRET_FILE",
    "PLAN_PAID_PRICE_MINOR_UNITS",
    "PLAN_PAID_CURRENCY",
] as const

describe("AppConfigService",
    () => {
        const readFileSyncMock = readFileSync as jest.Mock
        const saved: Record<string, string | undefined> = {
        }
        let moduleRef: TestingModule
        let service: AppConfigService

        beforeEach(async () => {
            for (const key of ENV_KEYS) {
                saved[key] = process.env[key]
                delete process.env[key]
            }
            readFileSyncMock.mockReset()
            moduleRef = await Test.createTestingModule({
                imports: [ConfigModule.register()] 
            }).compile()
            service = moduleRef.get(AppConfigService)
        })

        afterEach(async () => {
            await moduleRef.close()
            for (const key of ENV_KEYS) {
                if (saved[key] === undefined) delete process.env[key]
                else process.env[key] = saved[key]
            }
        })

        it("returns the declared defaults when no environment variable is set",
            () => {
                expect(service.getSessionTtlDays()).toBe(30)
                expect(service.getKeycloakTokenUrl()).toBe(
                    "http://localhost:8089/realms/todo/protocol/openid-connect/token",
                )
                expect(service.getKeycloakClientId()).toBe("todo-api")
                expect(service.getDatabaseUrl()).toBe("postgres://postgres:postgres@localhost:5432/todo")
                expect(service.getCorsOrigin()).toBe("http://localhost:3000")
                expect(service.getPort()).toBe(3001)
                expect(service.getRecurTickCron()).toBe("*/5 * * * *")
                expect(service.getSmtpHost()).toBe("localhost")
                expect(service.getSmtpPort()).toBe(1025)
                expect(service.getSmtpFromAddress()).toBe("notify@todo.dev")
                expect(service.getRedisUrl()).toBe("redis://localhost:6379")
                expect(service.getSepayBaseUrl()).toBe("https://my.sepay.vn")
                expect(service.getPaidPlanPriceMinorUnits()).toBe(99000)
                expect(service.getPaidPlanCurrency()).toBe("VND")
            })

        it("reads string settings from the environment verbatim",
            () => {
                process.env.KEYCLOAK_TOKEN_URL = "https://idp.example.com/token"
                process.env.KEYCLOAK_CLIENT_ID = "custom-client"
                process.env.DATABASE_URL = "postgres://db.internal:5432/prod"
                process.env.CORS_ORIGIN = "https://app.example.com"
                process.env.RECUR_TICK_CRON = "0 * * * *"
                process.env.SMTP_HOST = "smtp.internal"
                process.env.SMTP_FROM = "alerts@example.com"
                process.env.REDIS_URL = "redis://cache.internal:6380"
                process.env.SEPAY_BASE_URL = "https://sandbox.sepay.vn"
                process.env.PLAN_PAID_CURRENCY = "USD"

                expect(service.getKeycloakTokenUrl()).toBe("https://idp.example.com/token")
                expect(service.getKeycloakClientId()).toBe("custom-client")
                expect(service.getDatabaseUrl()).toBe("postgres://db.internal:5432/prod")
                expect(service.getCorsOrigin()).toBe("https://app.example.com")
                expect(service.getRecurTickCron()).toBe("0 * * * *")
                expect(service.getSmtpHost()).toBe("smtp.internal")
                expect(service.getSmtpFromAddress()).toBe("alerts@example.com")
                expect(service.getRedisUrl()).toBe("redis://cache.internal:6380")
                expect(service.getSepayBaseUrl()).toBe("https://sandbox.sepay.vn")
                expect(service.getPaidPlanCurrency()).toBe("USD")
            })

        it("parses numeric settings from the environment",
            () => {
                process.env.TODO_SESSION_TTL_DAYS = "7"
                process.env.PORT = "8080"
                process.env.SMTP_PORT = "2525"
                process.env.PLAN_PAID_PRICE_MINOR_UNITS = "150000"

                expect(service.getSessionTtlDays()).toBe(7)
                expect(service.getPort()).toBe(8080)
                expect(service.getSmtpPort()).toBe(2525)
                expect(service.getPaidPlanPriceMinorUnits()).toBe(150000)
            })

        it("treats an empty-string environment value as unset for the truthy-checked getters",
            () => {
                process.env.PORT = ""
                process.env.TODO_SESSION_TTL_DAYS = ""

                expect(service.getPort()).toBe(3001)
                expect(service.getSessionTtlDays()).toBe(30)
            })

        it("passes an empty-string environment value through verbatim for the nullish-checked getters",
            () => {
                process.env.KEYCLOAK_CLIENT_ID = ""

                expect(service.getKeycloakClientId()).toBe("")
            })

        it("returns an empty secret when the *_FILE variable is unset, without touching the filesystem",
            () => {
                expect(service.getSepayApiKey()).toBe("")
                expect(service.getSepayWebhookSecret()).toBe("")
                expect(readFileSyncMock).not.toHaveBeenCalled()
            })

        it("reads a secret from the file the *_FILE variable names, trimmed",
            () => {
                process.env.SEPAY_API_KEY_FILE = "/run/secrets/sepay.key"
                process.env.SEPAY_WEBHOOK_SECRET_FILE = "/run/secrets/sepay.webhook"
                readFileSyncMock.mockReturnValue("  sk_live_123\n")

                expect(service.getSepayApiKey()).toBe("sk_live_123")
                expect(service.getSepayWebhookSecret()).toBe("sk_live_123")
                expect(readFileSyncMock).toHaveBeenCalledWith("/run/secrets/sepay.key",
                    "utf8")
                expect(readFileSyncMock).toHaveBeenCalledWith("/run/secrets/sepay.webhook",
                    "utf8")
            })

        it("returns an empty secret instead of throwing when the secret file cannot be read",
            () => {
                process.env.SEPAY_API_KEY_FILE = "/run/secrets/missing.key"
                readFileSyncMock.mockImplementation(() => {
                    throw new Error("ENOENT")
                })

                expect(service.getSepayApiKey()).toBe("")
            })

        it("treats an empty-string *_FILE variable as unset without touching the filesystem",
            () => {
                process.env.SEPAY_API_KEY_FILE = ""
                process.env.SEPAY_WEBHOOK_SECRET_FILE = ""

                expect(service.getSepayApiKey()).toBe("")
                expect(service.getSepayWebhookSecret()).toBe("")
                expect(readFileSyncMock).not.toHaveBeenCalled()
            })

        it("returns an empty secret when the file holds only whitespace",
            () => {
                process.env.SEPAY_API_KEY_FILE = "/run/secrets/blank.key"
                readFileSyncMock.mockReturnValue(" \n\t ")

                expect(service.getSepayApiKey()).toBe("")
            })

        it("parses a numeric '0' verbatim rather than falling back to the default",
            () => {
                process.env.PORT = "0"
                process.env.TODO_SESSION_TTL_DAYS = "0"
                process.env.SMTP_PORT = "0"
                process.env.PLAN_PAID_PRICE_MINOR_UNITS = "0"

                expect(service.getPort()).toBe(0)
                expect(service.getSessionTtlDays()).toBe(0)
                expect(service.getSmtpPort()).toBe(0)
                expect(service.getPaidPlanPriceMinorUnits()).toBe(0)
            })

        it("does no validation: a non-numeric value reaches the caller as NaN",
            () => {
                process.env.PORT = "not-a-number"
                process.env.TODO_SESSION_TTL_DAYS = "thirty"
                process.env.SMTP_PORT = "submission"
                process.env.PLAN_PAID_PRICE_MINOR_UNITS = "free"

                expect(service.getPort()).toBeNaN()
                expect(service.getSessionTtlDays()).toBeNaN()
                expect(service.getSmtpPort()).toBeNaN()
                expect(service.getPaidPlanPriceMinorUnits()).toBeNaN()
            })
    })
