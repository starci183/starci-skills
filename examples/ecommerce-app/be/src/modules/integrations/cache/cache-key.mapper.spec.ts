import type { CacheKey } from "./cache.contracts"
import { cacheKeyText, defineCacheKey } from "./cache-key.mapper"

const key: CacheKey<string> = {
    name: "catalog.product",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
}

describe("defineCacheKey", () => {
    it("keeps the declared cache key unchanged", () => {
        expect(defineCacheKey(key)).toBe(key)
    })
})

describe("cacheKeyText", () => {
    it.each([
        [[], "catalog.product"],
        [["product-1"], "catalog.product:product-1"],
        [["tenant-1", "product-1"], "catalog.product:tenant-1:product-1"],
    ])("joins the key name and %j arguments", (args, expected) => {
        expect(cacheKeyText({ key, args })).toBe(expected)
    })
})
