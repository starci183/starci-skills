import { Secret } from "@modules/platform/config"
import { defineCacheKey } from "./cache-key.mapper"
import { CacheError, CacheErrorCode } from "./errors/cache.error"
import { RedisCacheClient } from "./redis-cache.client"

const mockRedis = {
    status: "ready",
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
    connect: jest.fn(),
}

jest.mock("ioredis", () => ({ __esModule: true, default: jest.fn(() => mockRedis) }))

const KEY = defineCacheKey<string>({
    name: "sample.token",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
})

const cache = (): RedisCacheClient => new RedisCacheClient({ url: new Secret("redis://localhost:6379") })

describe("RedisCacheClient", () => {
    beforeEach(() => {
        for (const command of [mockRedis.get, mockRedis.set, mockRedis.del, mockRedis.ping, mockRedis.quit, mockRedis.connect]) {
            command.mockReset()
        }
        mockRedis.status = "ready"
    })

    it("stores a JSON value under the key text with the declared time to live", async () => {
        await cache().set({ key: KEY, args: ["a"], value: "v" })
        expect(mockRedis.set).toHaveBeenCalledWith("sample.token:a", '"v"', "EX", 60)
    })

    it("reads a stored value through the key parser and answers null for a miss", async () => {
        mockRedis.get.mockResolvedValueOnce('"v"').mockResolvedValueOnce(null).mockResolvedValueOnce("7")
        const target = cache()
        await expect(target.get({ key: KEY, args: ["a"] })).resolves.toBe("v")
        await expect(target.get({ key: KEY, args: ["b"] })).resolves.toBeNull()
        await expect(target.get({ key: KEY, args: ["c"] })).resolves.toBeNull()
    })

    it("fails as unreadable when the stored value is not JSON", async () => {
        mockRedis.get.mockResolvedValueOnce("{oops")
        await expect(cache().get({ key: KEY, args: ["a"] })).rejects.toMatchObject({ code: CacheErrorCode.ReplyUnreadable })
    })

    it("removes an entry", async () => {
        await cache().del({ key: KEY, args: ["a"] })
        expect(mockRedis.del).toHaveBeenCalledWith("sample.token:a")
    })

    it("fails as unavailable when the store rejects", async () => {
        mockRedis.get.mockRejectedValueOnce(new TypeError("connection refused"))
        const call = cache().get({ key: KEY, args: ["a"] })
        await expect(call).rejects.toBeInstanceOf(CacheError)
        mockRedis.ping.mockRejectedValueOnce(new TypeError("down"))
        await expect(cache().check()).rejects.toMatchObject({ code: CacheErrorCode.Unavailable })
    })

    it("connects lazily before the first command", async () => {
        mockRedis.status = "wait"
        mockRedis.ping.mockResolvedValueOnce("PONG")
        await cache().check()
        expect(mockRedis.connect).toHaveBeenCalledTimes(1)
    })
})
