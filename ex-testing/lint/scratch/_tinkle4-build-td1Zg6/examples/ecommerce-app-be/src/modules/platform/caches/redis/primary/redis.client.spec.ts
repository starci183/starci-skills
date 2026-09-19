import {
    Test, TestingModule 
} from "@nestjs/testing"
import Redis from "ioredis"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    RedisPrimaryClient 
} from "./redis.client"

jest.mock("ioredis",
    () => {
        class FakeRedis {
            static instances: Array<FakeRedis> = []
            status = "wait"
            readonly connect = jest.fn(async () => {
                this.status = "ready"
            })
            readonly ping = jest.fn(async () => "PONG")
            readonly set = jest.fn(async () => "OK")
            readonly get = jest.fn(async () => "stored-value")
            readonly del = jest.fn(async () => 1)
            readonly quit = jest.fn(async () => "OK")
            constructor(
      readonly url: string,
      readonly options: unknown,
            ) {
                FakeRedis.instances.push(this)
            }
        }
        return {
            __esModule: true, default: FakeRedis 
        }
    })

interface FakeRedis {
  status: string;
  url: string;
  options: { lazyConnect?: boolean; maxRetriesPerRequest?: number };
  connect: jest.Mock;
  ping: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  quit: jest.Mock;
}

describe("RedisPrimaryClient - the session store handle",
    () => {
        const instances = (): Array<FakeRedis> =>
            (Redis as unknown as { instances: Array<FakeRedis> }).instances

        const boot = async (url = "redis://localhost:6448/0") => {
            const moduleRef: TestingModule = await Test.createTestingModule({
                providers: [
                    RedisPrimaryClient,
                    {
                        provide: AppConfigService, useValue: {
                            getRedisUrl: () => url 
                        } 
                    },
                ],
            }).compile()
            return {
                moduleRef,
                client: moduleRef.get(RedisPrimaryClient),
                redis: instances().at(-1)!,
            }
        }

        beforeEach(() => {
            instances().length = 0
        })

        it("constructs ioredis lazily against the configured url - a missing server must not crash boot",
            async () => {
                const { moduleRef, redis } = await boot("redis://configured:6379/3")
                try {
                    expect(redis.url).toBe("redis://configured:6379/3")
                    expect(redis.options).toEqual({
                        lazyConnect: true, maxRetriesPerRequest: 1 
                    })
                    expect(redis.connect).not.toHaveBeenCalled()
                } finally {
                    await moduleRef.close()
                }
            })

        it("connects on first use and accepts a PONG reply",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    await expect(client.ping()).resolves.toBeUndefined()
                    expect(redis.connect).toHaveBeenCalledTimes(1)
                    expect(redis.ping).toHaveBeenCalledTimes(1)
                } finally {
                    await moduleRef.close()
                }
            })

        it("rejects a non-PONG ping reply instead of reporting healthy",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    redis.status = "ready"
                    redis.ping.mockResolvedValue("NOPE")
                    await expect(client.ping()).rejects.toThrow(/unexpected Redis ping reply/)
                } finally {
                    await moduleRef.close()
                }
            })

        it("delegates store/lookup/forget to set/get/del with the EX ttl form",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    redis.status = "ready"
                    await client.store("session:1",
                        "opaque",
                        3600)
                    await expect(client.lookup("session:1")).resolves.toBe("stored-value")
                    await client.forget("session:1")

                    expect(redis.set).toHaveBeenCalledWith("session:1",
                        "opaque",
                        "EX",
                        3600)
                    expect(redis.get).toHaveBeenCalledWith("session:1")
                    expect(redis.del).toHaveBeenCalledWith("session:1")
                    expect(redis.connect).not.toHaveBeenCalled()
                } finally {
                    await moduleRef.close()
                }
            })

        it("treats an already-in-flight connect as progress, not failure",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    redis.connect.mockImplementation(async () => {
                        redis.status = "ready"
                        throw new Error("Redis is already connecting")
                    })
                    await expect(client.ping()).resolves.toBeUndefined()
                    expect(redis.connect).toHaveBeenCalledTimes(1)
                } finally {
                    await moduleRef.close()
                }
            })

        it("a genuine connect refusal propagates instead of being mistaken for an in-flight connect",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    redis.connect.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:6379"))
                    await expect(client.ping()).rejects.toThrow(/ECONNREFUSED/)
                } finally {
                    await moduleRef.close()
                }
            })

        it("fails honestly when the server never becomes ready",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    redis.status = "connecting"
                    await expect(client.ping()).rejects.toThrow(/did not become ready/)
                } finally {
                    await moduleRef.close()
                }
            },
            10000)

        it("fails immediately on a closed connection instead of waiting out the deadline",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    redis.status = "end"
                    await expect(client.ping()).rejects.toThrow(/Redis connection is end/)
                } finally {
                    await moduleRef.close()
                }
            })

        it("quits the connection on close",
            async () => {
                const { moduleRef, client, redis } = await boot()
                try {
                    await client.close()
                    expect(redis.quit).toHaveBeenCalledTimes(1)
                } finally {
                    await moduleRef.close()
                }
            })
    })
