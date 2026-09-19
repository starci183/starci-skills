import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    existsSync, readFileSync 
} from "node:fs"
import {
    dirname, join 
} from "node:path"
import {
    AppConfigService,
    DATABASE_URL_ENV,
    METADATA_FILE_ENV,
    ORDER_API_URL_ENV,
    PORT_ENV,
    REDIS_URL_ENV,
    SESSION_TTL_SECONDS_ENV,
} from "./app-config.service"
import {
    ConfigModule 
} from "./config.module"

jest.mock("node:fs",
    () => {
        const actual = jest.requireActual<typeof import("node:fs")>("node:fs")
        return {
            ...actual, existsSync: jest.fn(), readFileSync: jest.fn() 
        }
    })

const ENV_KEYS = [
    METADATA_FILE_ENV,
    PORT_ENV,
    DATABASE_URL_ENV,
    REDIS_URL_ENV,
    ORDER_API_URL_ENV,
    SESSION_TTL_SECONDS_ENV,
]

const METADATA = {
    project: "ecommerce-app",
    ports: {
        identityApi: 5070, orderApi: 6070, postgres: 5501, redis: 6448 
    },
}

describe("AppConfigService (identity) - the metadata.json runtime projection",
    () => {
        const existsSyncMock = existsSync as jest.Mock
        const readFileSyncMock = readFileSync as jest.Mock
        const saved: Record<string, string | undefined> = {
        }

        const boot = (): Promise<TestingModule> =>
            Test.createTestingModule({
                imports: [ConfigModule.register()] 
            }).compile()

        const fileFoundAt = (file: string, body: unknown = METADATA): void => {
            existsSyncMock.mockImplementation((path: string) => path === file)
            readFileSyncMock.mockReturnValue(typeof body === "string" ? body : JSON.stringify(body))
        }

        beforeEach(() => {
            for (const key of ENV_KEYS) {
                saved[key] = process.env[key]
                delete process.env[key]
            }
            existsSyncMock.mockReset().mockReturnValue(false)
            readFileSyncMock.mockReset()
        })

        afterEach(() => {
            for (const key of ENV_KEYS) {
                if (saved[key] === undefined) delete process.env[key]
                else process.env[key] = saved[key]
            }
        })

        it("reads every binding from the metadata file the env var names",
            async () => {
                fileFoundAt("/checkout/metadata.json")
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"

                const moduleRef = await boot()
                try {
                    const service = moduleRef.get(AppConfigService)
                    expect(service.getProject()).toBe("ecommerce-app")
                    expect(service.getPort()).toBe(5070)
                    expect(service.getDatabaseUrl()).toBe("postgres://postgres@localhost:5501/ecommerce")
                    expect(service.getRedisUrl()).toBe("redis://localhost:6448/0")
                    expect(service.getOrderApiBaseUrl()).toBe("http://localhost:6070")
                    expect(service.getSessionTtlSeconds()).toBe(3600)
                } finally {
                    await moduleRef.close()
                }
            })

        it("walks upward from the process cwd when the env var is unset",
            async () => {
                const cwd = process.cwd()
                const parentFile = join(dirname(cwd),
                    "metadata.json")
                existsSyncMock.mockImplementation((path: string) => path === parentFile)
                readFileSyncMock.mockReturnValue(JSON.stringify(METADATA))

                const moduleRef = await boot()
                try {
                    expect(moduleRef.get(AppConfigService).getPort()).toBe(5070)
                    expect(existsSyncMock).toHaveBeenCalledWith(join(cwd,
                        "metadata.json"))
                    expect(existsSyncMock).toHaveBeenCalledWith(parentFile)
                } finally {
                    await moduleRef.close()
                }
            })

        it("lets deployment env vars override the resolved projection",
            async () => {
                fileFoundAt("/checkout/metadata.json")
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"
                process.env[PORT_ENV] = "9090"
                process.env[DATABASE_URL_ENV] = "postgres://prod-db:5432/identity"
                process.env[REDIS_URL_ENV] = "redis://prod-cache:6379/2"
                process.env[ORDER_API_URL_ENV] = "https://order.internal"
                process.env[SESSION_TTL_SECONDS_ENV] = "120"

                const moduleRef = await boot()
                try {
                    const service = moduleRef.get(AppConfigService)
                    expect(service.getPort()).toBe(9090)
                    expect(service.getDatabaseUrl()).toBe("postgres://prod-db:5432/identity")
                    expect(service.getRedisUrl()).toBe("redis://prod-cache:6379/2")
                    expect(service.getOrderApiBaseUrl()).toBe("https://order.internal")
                    expect(service.getSessionTtlSeconds()).toBe(120)
                } finally {
                    await moduleRef.close()
                }
            })

        it("fails fast when the env var names a file that does not exist",
            async () => {
                process.env[METADATA_FILE_ENV] = "/checkout/missing.json"
                existsSyncMock.mockReturnValue(false)

                await expect(boot()).rejects.toThrow(/does not exist/)
            })

        it("fails fast when no metadata.json is reachable from the cwd upward",
            async () => {
                existsSyncMock.mockReturnValue(false)

                await expect(boot()).rejects.toThrow(/no metadata\.json found/)
            })

        it("fails fast when the metadata file is not readable JSON",
            async () => {
                fileFoundAt("/checkout/metadata.json",
                    "{{{not json")
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"

                await expect(boot()).rejects.toThrow(/not readable JSON/)
            })

        it("fails fast when the projection lacks a port this service reads",
            async () => {
                fileFoundAt("/checkout/metadata.json",
                    {
                        project: "ecommerce-app",
                        ports: {
                            identityApi: 5070, orderApi: 6070, postgres: 5501 
                        },
                    })
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"

                await expect(boot()).rejects.toThrow(/does not carry the resolved ports/)
            })

        it("fails fast when a carried port is not a number",
            async () => {
                fileFoundAt("/checkout/metadata.json",
                    {
                        project: "ecommerce-app",
                        ports: {
                            identityApi: "5070", orderApi: 6070, postgres: 5501, redis: 6448 
                        },
                    })
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"

                await expect(boot()).rejects.toThrow(/does not carry the resolved ports/)
            })

        it("answers an empty project name when the projection does not carry one",
            async () => {
                fileFoundAt("/checkout/metadata.json",
                    {
                        ports: METADATA.ports 
                    })
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"

                const moduleRef = await boot()
                try {
                    expect(moduleRef.get(AppConfigService).getProject()).toBe("")
                } finally {
                    await moduleRef.close()
                }
            })

        it("a non-numeric port override resolves to NaN - env vars are trusted, not validated",
            async () => {
                fileFoundAt("/checkout/metadata.json")
                process.env[METADATA_FILE_ENV] = "/checkout/metadata.json"
                process.env[PORT_ENV] = "not-a-port"

                const moduleRef = await boot()
                try {
                    expect(moduleRef.get(AppConfigService).getPort()).toBeNaN()
                } finally {
                    await moduleRef.close()
                }
            })
    })
