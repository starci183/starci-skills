import { Test } from "@nestjs/testing"
import type { CacheKey } from "./cache.contracts"
import { cacheKeyText, defineCacheKey } from "./cache-key.mapper"

const key: CacheKey<string> = {
    name: "catalog.product",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
}

const functions = { cacheKeyText, defineCacheKey }
const SUBJECT: unique symbol = Symbol("integrations/cache/cache-key.mapper")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cacheKeyText, defineCacheKey } }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("defineCacheKey", () => {
    it("keeps the declared cache key unchanged", async () => {
        const subject = await build()
        expect(subject.defineCacheKey(key)).toBe(key)
    })
})

describe("cacheKeyText", () => {
    it.each([
        [[], "catalog.product"],
        [["product-1"], "catalog.product:product-1"],
        [["tenant-1", "product-1"], "catalog.product:tenant-1:product-1"],
    ])("joins the key name and %j arguments", async (args, expected) => {
        const subject = await build()
        expect(subject.cacheKeyText({ key, args })).toBe(expected)
    })
})
