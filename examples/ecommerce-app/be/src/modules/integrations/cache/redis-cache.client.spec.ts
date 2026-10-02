import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import Redis from "ioredis"
import { Secret } from "@modules/platform/config"
import type { CacheKey } from "./cache.contracts"
import { RedisCacheClient } from "./redis-cache.client"
import { CacheErrorCode } from "./errors/cache.error"
import { MODULE_OPTIONS_TOKEN } from "./cache.module-definition"
import type { CacheOptions } from "./cache.options"

jest.mock("ioredis")

const RedisMock = jest.mocked(Redis)
const options: CacheOptions = { url: new Secret("redis://cache.test:6379"), timeoutMs: 2500 }

const cacheKey = () => {
    const parse = jest.fn<string | null, [unknown]>((stored) => (typeof stored === "string" ? stored : null))
    const key: CacheKey<string> = {
        name: "catalog.product",
        ttl: { seconds: 60 },
        store: "redis",
        parse,
    }
    return { key, parse }
}

const build = async (status: Redis["status"] = "wait") => {
    const redis = mock<Redis>({ status })
    RedisMock.mockImplementation(() => redis)
    const moduleRef = await Test.createTestingModule({
        providers: [RedisCacheClient, { provide: MODULE_OPTIONS_TOKEN, useValue: options }],
    }).compile()
    return { client: moduleRef.get(RedisCacheClient), redis }
}

describe("RedisCacheClient", () => {
    beforeEach(() => {
        RedisMock.mockReset()
    })

    it("opens a lazy Redis connection with the declared timeout", async () => {
        const { client } = await build()

        expect(client.name).toBe("cache")
        expect(RedisMock).toHaveBeenCalledWith("redis://cache.test:6379", {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            commandTimeout: 2500,
        })
    })

    it("connects a waiting client, decodes a stored value and validates it with the key", async () => {
        const { client, redis } = await build()
        const { key, parse } = cacheKey()
        redis.connect.mockResolvedValue(undefined)
        redis.get.mockResolvedValue(JSON.stringify("product-value"))

        await expect(client.get({ key, args: ["product-1"] })).resolves.toBe("product-value")

        expect(redis.connect).toHaveBeenCalledTimes(1)
        expect(redis.get).toHaveBeenCalledWith("catalog.product:product-1")
        expect(parse).toHaveBeenCalledWith("product-value")
    })

    it("answers a miss without parsing when Redis has no entry", async () => {
        const { client, redis } = await build("ready")
        const { key, parse } = cacheKey()
        redis.get.mockResolvedValue(null)

        await expect(client.get({ key, args: ["product-1"] })).resolves.toBeNull()

        expect(redis.connect).not.toHaveBeenCalled()
        expect(parse).not.toHaveBeenCalled()
    })

    it("answers a miss when the key rejects the decoded value", async () => {
        const { client, redis } = await build("ready")
        const { key, parse } = cacheKey()
        parse.mockReturnValue(null)
        redis.get.mockResolvedValue("{}")

        await expect(client.get({ key, args: [] })).resolves.toBeNull()
    })

    it("reports an unreadable stored reply", async () => {
        const { client, redis } = await build("ready")
        const { key } = cacheKey()
        redis.get.mockResolvedValue("not-json")

        await expect(client.get({ key, args: [] })).rejects.toMatchObject({
            code: CacheErrorCode.ReplyUnreadable,
            cause: expect.any(SyntaxError),
        })
    })

    it("maps a connection failure to cache unavailable", async () => {
        const { client, redis } = await build()
        const { key } = cacheKey()
        const failure = new Error("connection refused")
        redis.connect.mockRejectedValue(failure)

        await expect(client.get({ key, args: [] })).rejects.toMatchObject({
            code: CacheErrorCode.Unavailable,
            cause: failure,
        })

        expect(redis.get).not.toHaveBeenCalled()
    })

    it("maps a command failure to cache unavailable", async () => {
        const { client, redis } = await build("ready")
        const { key } = cacheKey()
        const failure = new Error("Redis timed out")
        redis.get.mockRejectedValue(failure)

        await expect(client.get({ key, args: [] })).rejects.toMatchObject({
            code: CacheErrorCode.Unavailable,
            cause: failure,
        })
    })

    it("stores JSON with the key's expiry", async () => {
        const { client, redis } = await build("ready")
        const { key } = cacheKey()
        redis.set.mockResolvedValue("OK")

        await client.set({ key, args: ["product-1"], value: "product-value" })

        expect(redis.set).toHaveBeenCalledWith("catalog.product:product-1", JSON.stringify("product-value"), "EX", 60)
    })

    it("deletes the named entry", async () => {
        const { client, redis } = await build("ready")
        const { key } = cacheKey()
        redis.del.mockResolvedValue(1)

        await client.del({ key, args: ["product-1"] })

        expect(redis.del).toHaveBeenCalledWith("catalog.product:product-1")
    })

    it("probes Redis with a ping", async () => {
        const { client, redis } = await build("ready")
        redis.ping.mockResolvedValue("PONG")

        await client.check()

        expect(redis.ping).toHaveBeenCalledTimes(1)
    })

    it("leaves a connection that was never opened alone on shutdown", async () => {
        const { client, redis } = await build()

        await client.onApplicationShutdown()

        expect(redis.quit).not.toHaveBeenCalled()
    })

    it("closes an opened connection on shutdown", async () => {
        const { client, redis } = await build("ready")
        redis.quit.mockResolvedValue("OK")

        await client.onApplicationShutdown()

        expect(redis.quit).toHaveBeenCalledTimes(1)
    })
})
