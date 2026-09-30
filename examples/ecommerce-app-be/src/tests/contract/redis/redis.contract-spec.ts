import { randomUUID } from "node:crypto"
import { CACHE, CacheModule, defineCacheKey, parseCacheConfig } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import { contractClient } from "../../world/contract.client"

const NAME_KEY = defineCacheKey<string>({
    name: "contract.name",
    ttl: { seconds: 30 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
})

/**
 * Contract of the Redis provider: the REAL cache integration (ioredis) against a Redis SANDBOX, the behaviour the RESP fake
 * of the e2e world imitates: a stored value reads back through the declared key, a missing entry reads as a miss, a deleted
 * entry is gone, and a value the key cannot narrow is a miss. Runs only when the sandbox is declared in the environment
 * (`CACHE_REDIS_URL` of a disposable Redis); otherwise skipped. No secret is read from or written to the repository.
 */
const sandbox = contractClient<Cache>({
    provider: "redis",
    keys: ["CACHE_REDIS_URL"],
    module: (env) => CacheModule.register({ isGlobal: true, ...parseCacheConfig(env) }),
    client: CACHE,
})

sandbox.describe("redis sandbox contract", () => {
    it("set -> get -> delete round trip, a miss and a value the key cannot narrow", async () => {
        const cache = sandbox.client()
        const args = [randomUUID()]

        await expect(cache.get({ key: NAME_KEY, args })).resolves.toBeNull()
        await cache.set({ key: NAME_KEY, args, value: "Ada" })
        await expect(cache.get({ key: NAME_KEY, args })).resolves.toBe("Ada")

        const NUMBER_KEY = defineCacheKey<number>({
            ...NAME_KEY,
            parse: (stored) => (typeof stored === "number" ? stored : null),
        })
        await expect(cache.get({ key: NUMBER_KEY, args })).resolves.toBeNull()

        await cache.del({ key: NAME_KEY, args })
        await expect(cache.get({ key: NAME_KEY, args })).resolves.toBeNull()
    })
})
