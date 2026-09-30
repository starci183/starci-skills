import { defineCacheKey } from "@modules/integrations/cache"
import { MemoryCacheClient } from "./memory-cache.client"

const NAME_KEY = defineCacheKey<string>({
    name: "spec.name",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
})

const COUNT_KEY = defineCacheKey<number>({
    name: "spec.name",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "number" ? stored : null),
})

describe("MemoryCacheClient", () => {
    it("answers what was stored under a key and its arguments, and nothing for another argument", async () => {
        const cache = new MemoryCacheClient()
        await cache.set({ key: NAME_KEY, args: ["a"], value: "Ada" })
        await expect(cache.get({ key: NAME_KEY, args: ["a"] })).resolves.toBe("Ada")
        await expect(cache.get({ key: NAME_KEY, args: ["b"] })).resolves.toBeNull()
    })

    it("reads a stored value the key cannot narrow as a miss", async () => {
        const cache = new MemoryCacheClient()
        await cache.set({ key: COUNT_KEY, args: ["a"], value: 1 })
        await expect(cache.get({ key: NAME_KEY, args: ["a"] })).resolves.toBeNull()
    })

    it("forgets a deleted entry and counts what it holds", async () => {
        const cache = new MemoryCacheClient()
        await cache.set({ key: NAME_KEY, args: ["a"], value: "Ada" })
        expect(cache.size()).toBe(1)
        await cache.del({ key: NAME_KEY, args: ["a"] })
        expect(cache.size()).toBe(0)
        await expect(cache.check()).resolves.toBeUndefined()
    })
})
