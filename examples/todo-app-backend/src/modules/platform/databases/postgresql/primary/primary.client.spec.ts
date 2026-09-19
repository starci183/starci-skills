import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    Pool 
} from "pg"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    PostgresPrimaryUnavailableException 
} from "@modules/shared/exceptions/errors/postgres/postgres-primary-unavailable"

import {
    PostgresPrimaryClient 
} from "./primary.client"

jest.mock("pg",
    () => ({
        Pool: jest.fn() 
    }))

describe("PostgresPrimaryClient",
    () => {
        const poolMock = Pool as unknown as jest.Mock
        let query: jest.Mock
        let end: jest.Mock
        let on: jest.Mock
        let log: jest.Mock

        const boot = async (databaseUrl = "postgres://u:p@h:5432/db") => {
            const moduleRef: TestingModule = await Test.createTestingModule({
                providers: [
                    PostgresPrimaryClient,
                    {
                        provide: AppConfigService, useValue: {
                            getDatabaseUrl: () => databaseUrl 
                        } 
                    },
                    {
                        provide: WinstonService, useValue: {
                            log 
                        } 
                    },
                ],
            }).compile()
            return {
                moduleRef, client: moduleRef.get(PostgresPrimaryClient) 
            }
        }

        beforeEach(() => {
            poolMock.mockReset()
            query = jest.fn()
            end = jest.fn().mockResolvedValue(undefined)
            on = jest.fn()
            log = jest.fn()
            poolMock.mockImplementation(() => ({
                query, end, on 
            }))
        })

        it("constructs the pg Pool with the configured connection string",
            async () => {
                const { moduleRef } = await boot("postgres://configured:5432/todo")
                try {
                    expect(poolMock).toHaveBeenCalledWith({
                        connectionString: "postgres://configured:5432/todo",
                        connectionTimeoutMillis: 5_000 
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("ping resolves when SELECT 1 returns exactly one row",
            async () => {
                query.mockResolvedValue({
                    rowCount: 1 
                })
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.ping()).resolves.toBeUndefined()
                    expect(query).toHaveBeenCalledWith("SELECT 1")
                } finally {
                    await moduleRef.close()
                }
            })

        it("ping wraps a driver failure in PostgresPrimaryUnavailableException",
            async () => {
                query.mockRejectedValue(new Error("connection refused"))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.ping()).rejects.toMatchObject({
                        code: "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
                        metadata: {
                            reason: expect.stringContaining("connection refused") 
                        },
                    })
                    await expect(client.ping()).rejects.toBeInstanceOf(PostgresPrimaryUnavailableException)
                } finally {
                    await moduleRef.close()
                }
            })

        it("ping refuses when the probe returns an unexpected row count",
            async () => {
                query.mockResolvedValue({
                    rowCount: 0 
                })
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.ping()).rejects.toMatchObject({
                        code: "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
                        metadata: {
                            reason: "unexpected row count" 
                        },
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("registers a pool 'error' listener so an idle client's death cannot crash the process",
            async () => {
                const { moduleRef } = await boot()
                try {
                    expect(on).toHaveBeenCalledWith("error",
                        expect.any(Function))
                } finally {
                    await moduleRef.close()
                }
            })

        it("registers a pool 'connect' listener that arms a per-client 'error' guard for the checked-out window",
            async () => {
                const { moduleRef } = await boot()
                try {
                    expect(on).toHaveBeenCalledWith("connect",
                        expect.any(Function))
                    const connectHandler = on.mock.calls.find(([event]) => event === "connect")?.[1] as (client: { on: jest.Mock }) => void
                    const clientOn = jest.fn()
                    connectHandler({
                        on: clientOn 
                    })
                    expect(clientOn).toHaveBeenCalledWith("error",
                        expect.any(Function))
                } finally {
                    await moduleRef.close()
                }
            })

        it("routes a pool 'error' event onto the winston surface instead of throwing",
            async () => {
                const { moduleRef } = await boot()
                try {
                    const handler = on.mock.calls.find(([event]) => event === "error")?.[1] as (error: unknown) => void
                    expect(() => handler(new Error("Connection terminated unexpectedly"))).not.toThrow()
                    expect(log).toHaveBeenCalledWith(LogEvent.POSTGRESQL_PRIMARY_POOL_IDLE_CLIENT_ERROR,
                        {
                            reason: expect.stringContaining("Connection terminated unexpectedly") 
                        })
                } finally {
                    await moduleRef.close()
                }
            })

        it("ends the pool when the Nest module is destroyed",
            async () => {
                const { moduleRef } = await boot()
                await moduleRef.close()
                expect(end).toHaveBeenCalledTimes(1)
            })

        it("ping stringifies a non-Error driver rejection into the exception reason",
            async () => {
                query.mockRejectedValue("socket hang up")
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.ping()).rejects.toMatchObject({
                        code: "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
                        metadata: {
                            reason: "socket hang up" 
                        },
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("ping refuses when the driver reports a null row count",
            async () => {
                query.mockResolvedValue({
                    rowCount: null 
                })
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.ping()).rejects.toMatchObject({
                        code: "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
                        metadata: {
                            reason: "unexpected row count" 
                        },
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("onModuleDestroy propagates a pool.end() rejection to the lifecycle caller",
            async () => {
                end.mockRejectedValue(new Error("pool drain failed"))
                const { moduleRef, client } = await boot()
                try {
                    await expect(client.onModuleDestroy()).rejects.toThrow("pool drain failed")
                } finally {
                    end.mockResolvedValue(undefined)
                    await moduleRef.close()
                }
            })

        it("fails module boot rather than the first ping when the Pool cannot be constructed",
            async () => {
                poolMock.mockImplementation(() => {
                    throw new Error("invalid connection string")
                })
                try {
                    await expect(boot()).rejects.toThrow()
                } finally {
                    poolMock.mockImplementation(() => ({
                        query, end, on 
                    }))
                }
            })
    })
